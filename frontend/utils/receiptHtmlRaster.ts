import { PaperDimensions } from './paperSize';

/**
 * Injects html2canvas capture script into the same receipt HTML used by QZ Tray / web print.
 * Output PNG width is scaled to thermal printer dot width (bleImageWidthPx).
 */
export function buildReceiptRasterHtml(fullReceiptHtml: string, paper: PaperDimensions): string {
    const scale = (paper.bleImageWidthPx / paper.widthPx).toFixed(3);
    const script = `
<script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"><\/script>
<script>
(function () {
  function send(payload) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }
  }

  function measureHeight() {
    var body = document.body;
    var html = document.documentElement;
    return Math.max(
      body.scrollHeight,
      body.offsetHeight,
      body.clientHeight,
      html ? html.scrollHeight : 0,
      480
    );
  }

  function capture() {
    if (!window.html2canvas) {
      send({ ok: false, data: null, error: 'html2canvas tidak termuat' });
      return;
    }

    var height = measureHeight();
    send({ type: 'height', value: height });

    html2canvas(document.body, {
      scale: ${scale},
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: ${paper.widthPx},
      height: height,
      windowWidth: ${paper.widthPx},
      windowHeight: height,
      scrollX: 0,
      scrollY: 0,
    }).then(function (canvas) {
      send({ ok: true, data: canvas.toDataURL('image/png', 1.0), error: null });
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