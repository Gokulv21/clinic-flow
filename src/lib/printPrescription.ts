/**
 * printPrescription
 * ─────────────────
 * Renders multiple prescription pages in a hexport function printPrescription(): void {
    const container = document.querySelector('.print-container');
    if (!container) {
        console.error('[printPrescription] .print-container not found');
        return;
    }

    // ── 1. Preparation: Clone the container ──────────────────────────
    const printMount = document.createElement('div');
    printMount.id = 'print-mount';
    printMount.style.cssText = 'position:absolute;top:0;left:0;width:100%;z-index:-1;visibility:hidden;';
    
    // We clone the inner content to avoid ID collisions and to manipulate styles if needed
    printMount.innerHTML = container.innerHTML;
    
    // Handle the handwriting images specifically to ensure they carry over correctly
    const originalImgs = container.querySelectorAll('img');
    const clonedImgs = printMount.querySelectorAll('img');
    originalImgs.forEach((img, i) => {
        if (clonedImgs[i]) clonedImgs[i].src = img.src;
    });

    document.body.appendChild(printMount);
    document.body.classList.add('is-printing');

    // ── 2. Trigger Print ────────────────────────────────────────────
    const triggerPrint = () => {
        window.print();
        
        // ── 3. Cleanup ─────────────────────────────────────────────
        setTimeout(() => {
            document.body.classList.remove('is-printing');
            if (document.getElementById('print-mount')) {
                document.body.removeChild(printMount);
            }
        }, 1000);
    };

    // Give it a moment to ensure all cloned images/styles are settled
    // On mobile, this delay is crucial for the print engine to 'see' the new DOM nodes
    setTimeout(triggerPrint, 500);
}
indow?.print();
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
