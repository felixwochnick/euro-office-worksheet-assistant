; Hooks for the Windows installer (Tauri's NSIS template; tauri.conf.json → bundle.windows.nsis.installerHooks).

; Stop this user's server program (worksheet-assistant.exe). The template only closes the app itself, but Claude
; Desktop keeps a server program running for each MCP connection, and Windows cannot replace or delete a running
; program.
!macro StopServerProgram
  ReadEnvStr $1 USERNAME
  nsExec::Exec 'taskkill /F /T /IM worksheet-assistant.exe /FI "USERNAME eq $1"'
  Pop $0
!macroend

!macro NSIS_HOOK_PREINSTALL
  !insertmacro StopServerProgram
!macroend

; Uninstalling (not as part of an update): first remove what the app set up outside its folder – the plugin in
; the Euro-Office / Nextcloud Office desktop editors, the autostart entry and the entry in Claude Desktop.
!macro NSIS_HOOK_PREUNINSTALL
  ${If} $UpdateMode <> 1
    nsExec::Exec '"$INSTDIR\worksheet-assistant.exe" uninstall'
    Pop $0
  ${EndIf}
  !insertmacro StopServerProgram
!macroend
