/**
 * printPrescription
 * ─────────────────
 * Renders multiple prescription pages in a hidden iframe and prints them.
 */
export function printPrescription(): void {
    // ── Get the container holding all pages ──────────────────────────
    const container = document.querySelector('.print-container');
    if (!container) {
        console.error('[printPrescription] .print-container not found');
        return;
    }

    // Capture pages
    const pages = container.querySelectorAll('.single-page-prescription');
    if (pages.length === 0) {
        console.error('[printPrescription] No .single-page-prescription found');
        return;
    }

    let finalHtml = '';

    // Process each page
    pages.forEach((pageEl, idx) => {
        let html = pageEl.outerHTML;
        
        // Find handwriting img if exists
        const hwImg = pageEl.querySelector('img[alt^="handwriting"]') as HTMLImageElement | null;
        if (hwImg) {
            const hwSrc = hwImg.src;
            // Remove old img tag from HTML string
            html = html.replace(/<img[^>]+alt="handwriting[^>]*"[^>]*>/i, '');
            // Append clean img tag
            const imgTag = `<img src="${hwSrc}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:fill;z-index:99;pointer-events:none;" alt="handwriting">`;
            html = html.replace(/<\/div>\s*$/i, `${imgTag}</div>`);
        }
        
        finalHtml += html;
    });

    // ── Create hidden iframe ───────────────────────────────────────────
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;border:none;opacity:0;';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }

    doc.open();
    doc.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Prescription</title>
<style>
/* ── Reset ─────────────────────────────────────────────────────── */
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { background: #fff; }

/* ── Page container ─────────────────────────────────────────────── */
.single-page-prescription {
    width: 210mm !important;
    height: 296mm !important; /* Slightly reduced to prevent overflow spills */
    position: relative !important;
    overflow: hidden !important;
    box-shadow: none !important;
    aspect-ratio: unset !important;
    container-type: inline-size !important;
    page-break-after: always !important;
    break-after: page !important;
}

/* ── Inner wrapper ─────────────────────────────────────────────── */
#rx-inner {
    font-size: 3.5mm !important; 
    position: absolute !important;
    inset: 0 !important;
    overflow: hidden !important;
}

/* ── Print ──────────────────────────────────────────────────────── */
@page { 
    margin: 0; 
    size: A4 portrait; 
}

@media print {
    /* Hide everything that isn't the print container */
    body > *:not(.print-container) {
        display: none !important;
    }
    
    * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }
    html, body { 
        margin: 0; 
        padding: 0; 
        background: #fff !important;
    }
    .print-container { 
        width: 210mm !important; 
        margin: 0 !important;
        padding: 0 !important;
    }
}
</style>
</head>
<body>
    <div class="print-container">
        ${finalHtml}
    </div>
</body>
</html>`);
    doc.close();

    // ── Print after allowing fonts + images to render ─────────
    const doprint = () => {
        if (!iframe.contentWindow) return;
        
        // Mobile-specific focus-and-wait pattern
        iframe.contentWindow.focus();
        
        setTimeout(() => {
            iframe.contentWindow?.print();
            const cleanup = () => {
                try { document.body.removeChild(iframe); } catch (_) { /* already removed */ }
            };
            iframe.contentWindow?.addEventListener('afterprint', cleanup, { once: true });
            setTimeout(cleanup, 30_000); // Increased fallback
        }, 200); // 200ms delay helps mobile browsers register the focus change
    };

    if (doc.readyState === 'complete') {
        setTimeout(doprint, 1200); // Slightly longer wait for image hydration
    } else {
        doc.addEventListener('DOMContentLoaded', () => setTimeout(doprint, 1200));
    }
}
