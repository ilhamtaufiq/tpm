import { getBleRasterSpec } from './paperSize';
import { HTML2CANVAS_CACHE_FILENAME } from './html2canvasBundle';

/**
 * Renders receipt HTML in WebView, rasterizes to thermal width, and returns
 * a JPEG base64 payload for native printImageData.
 */
export function buildReceiptRasterHtml(
    fullReceiptHtml: string,
    paperSize: string | null | undefined,
): string {
    const raster = getBleRasterSpec(paperSize);
    const scale = raster.captureScale.toFixed(4);
    const jpegQuality = raster.jpegQuality.toFixed(2);

    const captureScript = `
<script>
(function () {
  var TARGET_WIDTH = ${raster.targetWidthPx};
  var MAX_HEIGHT = ${raster.maxHeightPx};
  var LAYOUT_WIDTH = ${raster.layoutWidthPx};
  var CAPTURE_SCALE = ${scale};
  var JPEG_QUALITY = ${jpegQuality};
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
      var dataUrl = output.toDataURL('image/jpeg', JPEG_QUALITY);
      var comma = dataUrl.indexOf(',');
      var imageBase64 = comma >= 0 ? dataUrl.slice(comma + 1) : '';
      if (!imageBase64 || imageBase64.length < 64) {
        send({ ok: false, error: 'Gagal mengenkode gambar struk ke printer.' });
        return;
      }
      send({
        ok: true,
        imageBase64: imageBase64,
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