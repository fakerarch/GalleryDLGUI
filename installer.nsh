; ============================================================
; installer.nsh  — gallery-dl GUI  custom NSIS pages
; Injected into the electron-builder NSIS installer via
; the "include" key in package.json build.nsis section.
; ============================================================

; ── Macro: offered AFTER the main install ───────────────────
!macro customInstall

  ; Check whether gallery-dl.exe already exists in PATH
  nsExec::ExecToStack 'cmd /c "where gallery-dl.exe"'
  Pop $0   ; exit code
  Pop $1   ; stdout

  ${If} $0 != 0
    ; gallery-dl not found — offer to download it
    MessageBox MB_YESNO|MB_ICONQUESTION \
      "gallery-dl was not found on this computer.$\n$\n\
gallery-dl GUI is a frontend for the gallery-dl command-line tool.$\n\
Without it the app will launch but won't be able to download anything.$\n$\n\
Would you like to download gallery-dl.exe now and place it next to the app?$\n\
(Requires an internet connection — ~20 MB)" \
      IDNO skip_gdl_download

    ; Try winget first (available on Windows 10 1709+ and Windows 11)
    nsExec::ExecToStack 'cmd /c "winget --version"'
    Pop $R0
    ${If} $R0 == 0
      DetailPrint "Installing gallery-dl via winget..."
      nsExec::ExecToLog 'cmd /c "winget install --id mikf.gallery-dl --accept-source-agreements --accept-package-agreements --silent"'
      Pop $R1
      ${If} $R1 == 0
        MessageBox MB_OK|MB_ICONINFORMATION \
          "gallery-dl was installed successfully via winget.$\n\
It should now be available in your PATH."
        Goto skip_gdl_download
      ${EndIf}
      ; winget failed — fall through to manual download
    ${EndIf}

    ; Fallback: download the standalone gallery-dl.exe from GitHub and put it next to the app
    DetailPrint "Downloading gallery-dl.exe from GitHub..."
    inetc::get /NOCANCEL \
      "https://github.com/mikf/gallery-dl/releases/latest/download/gallery-dl.exe" \
      "$INSTDIR\gallery-dl.exe" \
      /END
    Pop $R2
    ${If} $R2 == "OK"
      MessageBox MB_OK|MB_ICONINFORMATION \
        "gallery-dl.exe has been placed next to the app at:$\n\
$INSTDIR\gallery-dl.exe$\n$\n\
gallery-dl GUI will find it automatically."
    ${Else}
      MessageBox MB_OK|MB_ICONEXCLAMATION \
        "Could not download gallery-dl.exe automatically (error: $R2).$\n$\n\
Please download it manually from:$\n\
https://github.com/mikf/gallery-dl/releases$\n$\n\
Place gallery-dl.exe next to the app or add it to your PATH."
      ExecShell "open" "https://github.com/mikf/gallery-dl/releases"
    ${EndIf}

    skip_gdl_download:
  ${Else}
    ; gallery-dl already present — nothing to do
    DetailPrint "gallery-dl found in PATH — skipping download."
  ${EndIf}

!macroend

; ── Macro: clean up on uninstall ────────────────────────────
!macro customUninstall
  ; Offer to remove gallery-dl.exe if we placed it next to the app
  ${If} ${FileExists} "$INSTDIR\gallery-dl.exe"
    MessageBox MB_YESNO|MB_ICONQUESTION \
      "gallery-dl.exe was found next to the app.$\n\
Would you like to remove it as well?" \
      IDNO skip_gdl_remove
    Delete "$INSTDIR\gallery-dl.exe"
    skip_gdl_remove:
  ${EndIf}
!macroend
