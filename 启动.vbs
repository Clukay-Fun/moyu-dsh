' 无终端启动入口：隐藏执行同目录的“启动.bat”。
Option Explicit

Dim shell, fs, folder, command
Set shell = CreateObject("WScript.Shell")
Set fs = CreateObject("Scripting.FileSystemObject")
folder = fs.GetParentFolderName(WScript.ScriptFullName)
command = Chr(34) & folder & "\启动.bat" & Chr(34)
shell.Run command, 0, False
