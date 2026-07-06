import { getBleRasterSpec } from './paperSize';
import { HTML2CANVAS_CACHE_FILENAME } from './html2canvasBundle';

/**
 * Same receipt HTML as QZ Tray — rasterized in WebView, ESC/POS encoded in JS,
 * sent via printRawData (no native bitmap decode; avoids "image not found").
 */
export function buildReceiptRasterHtml(
    fullReceiptHtml: string,
    paperSize: string | null | undefined,
): string {
    const raster = getBleRasterSpec(paperSize);
    const scale = raster.captureScale.toFixed(4);

    const captureScript = `
<script>
(function () {
  var TARGET_WIDTH = ${raster.targetWidthPx};
  var MAX_HEIGHT = ${raster.maxHeightPx};
  var LAYOUT_WIDTH = ${raster.layoutWidthPx};
  var CAPTURE_SCALE = ${scale};
  var started = false;

  function send(payload) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }
  }

  function measureHeight() {
    var body = document.body;
    var html = document.documentElement;
    var raw = Math.max(
      body.scrollHeight,
      body.offsetHeight,
      body.clientHeight,
      html ? html.scrollHeight : 0,
      480
    );
    return Math.min(raw, ${raster.layoutMaxHeightPx});
  }

  function finalizeForThermal(canvas) {
    var targetW = TARGET_WIDTH;
    var targetH = Math.max(1, Math.round(canvas.height * (targetW / canvas.width)));
    if (targetH > MAX_HEIGHT) {
      targetH = MAX_HEIGHT;
    }

    var out = document.createElement('canvas');
    out.width = targetW;
    out.height = targetH;
    var ctx = out.getContext('2d');
    if (!ctx) {
      return canvas;
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, targetW, targetH);
    return out;
  }

  function shouldPrint(r, g, b, a) {
    if (a < 128) return false;
    var luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    return luminance < 127;
  }

  function bytesToBase64(bytes) {
    var binary = '';
    var chunk = 8192;
    for (var i = 0; i < bytes.length; i += chunk) {
      var slice = bytes.slice(i, i + chunk);
      binary += String.fromCharCode.apply(null, slice);
    }
    return btoa(binary);
  }

  function canvasToEscPosBase64(canvas) {
    var ctx = canvas.getContext('2d');
    var w = canvas.width;
    var h = canvas.height;
    var imageData = ctx.getImageData(0, 0, w, h);
    var data = imageData.data;
    var bytes = [];

    function pushByte(value) {
      bytes.push(value & 0xff);
    }

    function pushBytes(arr) {
      for (var i = 0; i < arr.length; i++) {
        pushByte(arr[i]);
      }
    }

    pushBytes([0x1B, 0x40]);
    pushBytes([0x1B, 0x33, 24]);
    pushBytes([0x1B, 0x61, 0x31]);

    for (var y = 0; y < h; y += 24) {
      pushBytes([0x1B, 0x2A, 33]);
      pushByte(w & 0xff);
      pushByte((w >> 8) & 0xff);

      for (var x = 0; x < w; x++) {
        for (var band = 0; band < 3; band++) {
          var slice = 0;
          for (var bit = 0; bit < 8; bit++) {
            var row = y + band * 8 + bit;
            if (row < h) {
              var idx = (row * w + x) * 4;
              if (shouldPrint(data[idx], data[idx + 1], data[idx + 2], data[idx + 3])) {
                slice |= (1 << (7 - bit));
              }
            }
          }
          pushByte(slice);
        }
      }

      pushByte(0x0A);
    }

    pushBytes([0x1B, 0x33, 32]);
    pushByte(0x0A);

    return bytesToBase64(bytes);
  }

  function capture() {
    if (started) return;
    started = true;

    if (!window.html2canvas) {
      send({ ok: false, error: 'html2canvas tidak termuat dari bundle aplikasi.' });
      return;
    }

    var height = measureHeight();
    send({ type: 'height', value: height });

    html2canvas(document.body, {
      scale: CAPTURE_SCALE,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: LAYOUT_WIDTH,
      height: height,
      windowWidth: LAYOUT_WIDTH,
      windowHeight: height,
      scrollX: 0,
      scrollY: 0,
      imageTimeout: 15000,
    }).then(function (canvas) {
      var output = finalizeForThermal(canvas);
      var escPosBase64 = canvasToEscPosBase64(output);
      if (!escPosBase64 || escPosBase64.length < 32) {
        send({ ok: false, error: 'Gagal mengenkode gambar struk ke printer.' });
        return;
      }
      send({
        ok: true,
        escPosBase64: escPosBase64,
        width: output.width,
        height: output.height,
      });
    }).catch(function (err) {
      send({ ok: false, error: String(err) });
    });
  }

  function waitForImages() {
    var imgs = Array.prototype.slice.call(document.images || []);
    if (!imgs.length) {
      setTimeout(capture, 320);
      return;
    }

    var pending = imgs.length;
    var done = function () {
      pending -= 1;
      if (pending <= 0) {
        setTimeout(capture, 320);
      }
    };

    imgs.forEach(function (img) {
      if (img.complete && img.naturalWidth > 0) {
        done();
      } else {
        img.onload = done;
        img.onerror = done;
      }
    });
  }

  function boot() {
    if (!window.html2canvas) {
      setTimeout(boot, 120);
      return;
    }
    waitForImages();
  }

  if (document.readyState === 'complete') {
    setTimeout(boot, 80);
  } else {
    window.addEventListener('load', function () {
      setTimeout(boot, 80);
    });
  }
})();
<\/script>`;

    const libraryScript = `<script src="${HTML2CANVAS_CACHE_FILENAME}"><\/script>`;
    const injected = `${libraryScript}${captureScript}`;

    if (fullReceiptHtml.includes('</body>')) {
        return fullReceiptHtml.replace('</body>', `${injected}</body>`);
    }

    return `${fullReceiptHtml}${injected}`;
}