# Put TurboGames on Google Sites

1. Extract the TurboGames ZIP.
2. Upload the folder containing `index.html` to [Netlify Drop](https://app.netlify.com/drop), or another static website host. Keep all of its files and folders together. Copy the HTTPS address the host gives you.
3. Open `google-sites.html` from the download or visit `/google-sites.html` on your hosted arcade. Paste your hosted TurboGames address and choose **Make embed code**, then **Copy embed code**.
4. In your Google Sites editor, choose **Insert → Embed → Embed code**. Paste the code, choose **Next → Insert**, and make the embed wide and tall. Publish your Google Site.

You can also paste the generated embed URL into **Insert → Embed → By URL**. The address ends with `?embed=1`, which uses a compact arcade layout.

Google Sites cannot host or run the ZIP or folder directly. The arcade must remain on an HTTPS website host. If Netlify Drop cannot accept the full library, use a deployment method or host that supports the folder’s size; keep the complete game library beside the site files.

The generated embed allows fullscreen and includes an **Open TurboGames in a new tab** link. Google Sites and browsers control permissions for embedded pages, so some games or fullscreen may work better in that new tab. Some launchers also need their original online assets to remain available.

The included `netlify.toml` publishes this folder directly, with no build step. The `_headers` file does not restrict framing, so the arcade can be embedded on Google Sites.
