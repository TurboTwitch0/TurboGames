# Local Ruffle runtime

This is the unmodified official `@ruffle-rs/ruffle` **0.7.1** self-hosted browser package from the npm registry. The archive was verified against the registry’s SHA-512 integrity value before extraction. `PROVENANCE.json` records the source and checksums.

Load `vendor/ruffle/ruffle.js` from the arcade root, or use the correct relative path from each game launcher. Keep this entire directory together: Ruffle loads its JavaScript chunks and WebAssembly files from beside `ruffle.js`.

The runtime normally discovers its asset directory from the script URL. When an explicit location is needed, set this **before** loading the script:

```html
<script>
  window.RufflePlayer = window.RufflePlayer || {};
  window.RufflePlayer.config = {
    ...window.RufflePlayer.config,
    publicPath: new URL("/vendor/ruffle/", location.origin).href,
    allowFullscreen: true
  };
</script>
<script src="/vendor/ruffle/ruffle.js"></script>
```

These leading-slash paths assume the arcade is hosted at the website root. When hosted under a subdirectory, include that prefix, or compute a relative URL for the launcher’s location. Preserve the trailing slash on `publicPath`.

Serve `.wasm` files with the `application/wasm` content type. Netlify does this automatically. Ruffle supports many Flash games, but compatibility depends on each game. Local Ruffle removes the remote runtime dependency; games can still depend on external SWF files and other assets.

Upstream documentation: <https://github.com/ruffle-rs/ruffle/wiki/Using-Ruffle#web>

Licensing: the package is available under **MIT OR Apache-2.0**. The complete upstream `LICENSE_MIT` and `LICENSE_APACHE` files are included unchanged.
