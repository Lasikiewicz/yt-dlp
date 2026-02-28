import sys
import subprocess

def main():
    # A robust PowerShell script to open the native FolderBrowserDialog
    # We create an invisible form exactly where the user's mouse clicked
    # and use it as the owner. This ensures it opens on the correct monitor
    # without attaching to the web browser's process handle (which crashed it).
    ps_script = """
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$cursorPos = [System.Windows.Forms.Cursor]::Position
$screen = [System.Windows.Forms.Screen]::FromPoint($cursorPos)

$form = New-Object System.Windows.Forms.Form
$form.StartPosition = 'Manual'
$form.Location = $screen.Bounds.Location
$form.Size = New-Object System.Drawing.Size(0,0)
$form.ShowInTaskbar = $false
$form.TopMost = $true

$form.Show()
$form.Activate()
$form.BringToFront()

$f = New-Object System.Windows.Forms.FolderBrowserDialog
$f.ShowNewFolderButton = $true
if ($f.ShowDialog($form) -eq 'OK') {
    Write-Output $f.SelectedPath
}
$form.Close()
"""
    result = subprocess.run(
        ["powershell", "-sta", "-NoProfile", "-Command", ps_script],
        capture_output=True,
        text=True
    )
    # Output the path back to the Node/Python backend
    folder_path = result.stdout.strip()
    if folder_path:
        print(folder_path)

if __name__ == "__main__":
    main()
