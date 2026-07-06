import { getBleRasterSpec } from './paperSize';

/**
 * Injects html2canvas capture script into receipt HTML.
 * Output is normalized to exact thermal dot width for the selected paper (58/80mm).
 */
export function buildReceiptRasterHtml(fullReceiptHtml: string, paperSize?: string | null): string {
    const raster = getBleRasterSpec(paperSize);
    const scale = raster.captureScale.toFixed(4);

    const script = `
<script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"><\/script>
<script>
(function () {
  var TARGET_WIDTH = ${raster.targetWidthPx};
  var MAX_HEIGHT = ${raster.maxHeightPx};
  var LAYOUT_WIDTH = ${raster.layoutWidthPx};
  var CAPTURE_SCALE = ${scale};
  var JPEG_QUALITY = ${raster.jpegQuality};

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
    ctx.drawImage(canvas, 0, 0, targetW, targetH);
    return out;
  }

  function capture() {
    if (!window.html2canvas) {
      send({ ok: false, data: null, error: 'html2canvas tidak termuat' });
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
    }).then(function (canvas) {
      var output = finalizeForThermal(canvas);
      send({
        ok: true,
        data: output.toDataURL('image/jpeg', JPEG_QUALITY),
        width: output.width,
        height: output.height,
        error: null,
      });
    }).catch(function (err) {
      send({ ok: false, data: null, error: String(err) });
    });
  }

  function waitForImages() {
    var imgs = Array.prototype.slice.call(document.images || []);
    if (!imgs.length) {
      setTimeout(capture, 180);
      return;
    }

    var pending = imgs.length;
    var done = function () {
      pending -= 1;
      if (pending <= 0) {
        setTimeout(capture, 180);
      }
    };

    imgs.forEach(function (img) {
      if (img.complete) {
        done();
      } else {
        img.onload = done;
        img.onerror = done;
      }
    });
  }

  if (document.readyState === 'complete') {
    waitForImages();
  } else {
    window.addEventListener('load', waitForImages);
  }
})();
<\/script>`;

    if (fullReceiptHtml.includes('</body>')) {
        return fullReceiptHtml.replace('</body>', `${script}</body>`);
    }

    return `${fullReceiptHtml}${script}`;
}