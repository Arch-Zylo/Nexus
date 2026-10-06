Nexus fonts (optional, keeps the original look while staying 100% offline)

Nexus no longer loads fonts from Google. To keep the original look, put these files in this folder
(both fonts are free under the SIL Open Font License, so they can be bundled in the app):

  DMSans-Variable.woff2     DM Sans, variable weight 400-700   (https://fonts.google.com/specimen/DM+Sans)
  DMSans-Italic.woff2       DM Sans Italic, regular weight
  IBMPlexMono-Regular.woff2   IBM Plex Mono 400   (https://fonts.google.com/specimen/IBM+Plex+Mono)
  IBMPlexMono-Medium.woff2    IBM Plex Mono 500
  IBMPlexMono-SemiBold.woff2  IBM Plex Mono 600

Download them once from the pages above (Google Fonts -> "Get font" / Download family) or from the
fontsource packages, convert to .woff2 if needed, and commit them. Nothing else needs to change.
Without these files the app simply uses the phone's built-in fonts.
