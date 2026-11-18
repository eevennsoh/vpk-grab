# Windows clipboard reader for `react-grab watch`. Reads CF_UNICODETEXT and the
# legacy Chromium pickle and the mapped async web custom format via Win32,
# in a single OpenClipboard so the reads are consistent.
# Emits { changeCount, text, pickleBase64, grab } as JSON; the CLI decodes the pickle
# (shared with macOS/Linux). GetClipboardSequenceNumber gives a cheap monotonic
# change token for idle polling.

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$source = @"
using System;
using System.Runtime.InteropServices;

public static class RgClip {
  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool OpenClipboard(IntPtr hWndNewOwner);
  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool CloseClipboard();
  [DllImport("user32.dll", SetLastError = true)]
  public static extern IntPtr GetClipboardData(uint uFormat);
  [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern uint RegisterClipboardFormat(string lpszFormat);
  [DllImport("user32.dll")]
  public static extern uint GetClipboardSequenceNumber();
  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool IsClipboardFormatAvailable(uint format);
  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern IntPtr GlobalLock(IntPtr hMem);
  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern bool GlobalUnlock(IntPtr hMem);
  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern UIntPtr GlobalSize(IntPtr hMem);

  public const uint UnicodeTextFormat = 13;

  public static byte[] ReadLocked(uint format) {
    if (!IsClipboardFormatAvailable(format)) return null;
    IntPtr handle = GetClipboardData(format);
    if (handle == IntPtr.Zero) return null;
    IntPtr pointer = GlobalLock(handle);
    if (pointer == IntPtr.Zero) return null;
    try {
      ulong size = GlobalSize(handle).ToUInt64();
      if (size == 0 || size > int.MaxValue) return null;
      byte[] bytes = new byte[(int)size];
      Marshal.Copy(pointer, bytes, 0, (int)size);
      return bytes;
    } finally {
      GlobalUnlock(handle);
    }
  }
}
"@

# Add-Type recompiles on every process start, so the reader is compiled to a
# cached assembly once and merely loaded on subsequent polls.
$cacheDir = Join-Path $env:TEMP "react-grab-watch"
# Key the cached DLL by a hash of the source so a changed reader recompiles
# instead of loading a stale assembly.
$sourceHashBytes = [System.Security.Cryptography.SHA256]::Create().ComputeHash([System.Text.Encoding]::UTF8.GetBytes($source))
$sourceHash = ([System.BitConverter]::ToString($sourceHashBytes) -replace "-", "").Substring(0, 16)
$cachedDll = Join-Path $cacheDir "RgClipReader-$sourceHash.dll"
$loaded = $false
if (Test-Path $cachedDll) {
  try { Add-Type -Path $cachedDll | Out-Null; $loaded = $true } catch {}
}
if (-not $loaded) {
  try {
    New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null
    Add-Type -TypeDefinition $source -Language CSharp -OutputAssembly $cachedDll -ErrorAction Stop | Out-Null
    Add-Type -Path $cachedDll | Out-Null
    $loaded = $true
  } catch {}
}
if (-not $loaded) {
  Add-Type -TypeDefinition $source -Language CSharp | Out-Null
}

$text = $null
$pickleBase64 = $null
$grab = $null
if (-not [RgClip]::OpenClipboard([IntPtr]::Zero)) { exit 1 }
try {
  $changeCount = [RgClip]::GetClipboardSequenceNumber()
  $textBytes = [RgClip]::ReadLocked([RgClip]::UnicodeTextFormat)
  if ($null -ne $textBytes) {
    $text = [System.Text.Encoding]::Unicode.GetString($textBytes).TrimEnd([char]0)
  }
  $pickle = [RgClip]::ReadLocked([RgClip]::RegisterClipboardFormat("Chromium Web Custom MIME Data Format"))
  if ($null -ne $pickle) {
    $pickleBase64 = [System.Convert]::ToBase64String($pickle)
  }
  $mapBytes = [RgClip]::ReadLocked([RgClip]::RegisterClipboardFormat("Web Custom Format Map"))
  if ($null -ne $mapBytes) {
    try {
      $formatMap = [System.Text.Encoding]::UTF8.GetString($mapBytes).TrimEnd([char]0) | ConvertFrom-Json
      $entry = $formatMap.'application/x-react-grab'
      if ($entry -is [string] -and $entry -cmatch '\AWeb Custom Format(?:0|[1-9][0-9]?)\z') {
        $grabBytes = [RgClip]::ReadLocked([RgClip]::RegisterClipboardFormat($entry))
        if ($null -ne $grabBytes) {
          $grab = [System.Text.Encoding]::UTF8.GetString($grabBytes).TrimEnd([char]0)
        }
      }
    } catch {}
  }
} finally {
  [RgClip]::CloseClipboard() | Out-Null
}

$payload = [ordered]@{
  changeCount  = [int64]$changeCount
  text         = $text
  pickleBase64 = $pickleBase64
  grab         = $grab
}

$payload | ConvertTo-Json -Compress
