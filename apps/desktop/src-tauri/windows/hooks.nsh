; Hooks for the Windows installer (Tauri's NSIS template; tauri.conf.json → bundle.windows.nsis.installerHooks).

; Stop this user's server program (worksheet-assistant.exe). The template only closes the app itself, but Claude
; Desktop keeps a server program running for each MCP connection, and Windows cannot replace or delete a running
; program.
!macro StopServerProgram
  ReadEnvStr $1 USERNAME
  nsExec::Exec 'taskkill /F /T /IM worksheet-assistant.exe /FI "USERNAME eq $1"'
  Pop $0
!macroend

; Up to version 0.8.1 the app was installed as "Arbeitsblatt-Assistent" (folder, Start menu entry, entry under Apps).
; Remove that installation the way an update does: /UPDATE keeps the plugin, the autostart entry and the entry in
; Claude Desktop (the new app points them to itself when it starts), but also the shortcuts and the install location
; in the registry – those go here.
!macro RemoveGermanNamedInstall
  Push $R9
  Push $0
  ReadRegStr $R9 HKCU "Software\Felix Wochnick\Arbeitsblatt-Assistent" ""
  ${If} $R9 != ""
  ${AndIf} ${FileExists} "$R9\uninstall.exe"
    ExecWait '"$R9\uninstall.exe" /S /UPDATE _?=$R9' $0
    Delete "$R9\uninstall.exe"
    RMDir "$R9"
    Delete "$SMPROGRAMS\Arbeitsblatt-Assistent.lnk"
    Delete "$DESKTOP\Arbeitsblatt-Assistent.lnk"
    DeleteRegKey HKCU "Software\Felix Wochnick\Arbeitsblatt-Assistent"
  ${EndIf}
  Pop $0
  Pop $R9
!macroend

!macro NSIS_HOOK_PREINSTALL
  !insertmacro StopServerProgram
  !insertmacro RemoveGermanNamedInstall
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
