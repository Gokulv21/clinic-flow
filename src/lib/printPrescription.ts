/**
 * printPrescription
 * ─────────────────
 * Renders multiple prescription pages by cloning them into a temporary container
 * and triggering the native print dialog. This approach is highly reliable on mobile/tablets.
 */
export function printPrescription(): void {
    const container = document.querySelector('.print-container');
    if (!container) {
        console.error('[printPrescription] .print-container not found');
        return;
    }

    // ── 1. Preparation: Clone the container ──────────────────────────
    const printMount = document.createElement('div');
    printMount.id = 'print-mount';
    // Position it off-screen and hide it from visual view, but keep it 'visible' to the print engine
    printMount.style.cssText = 'position:fixed;top:0;left:0;width:100%;opacity:0;z-index:-9999;pointer-events:none;';
    
    // Clone the inner content
    printMount.innerHTML = container.innerHTML;
    
    // Handle the handwriting images specifically to ensure they carry over correctly with their current srcs
    const originalImgs = container.querySelectorAll('img');
    const clonedImgs = printMount.querySelectorAll('img');
    originalImgs.forEach((img, i) => {
        if (clonedImgs[i]) {
            clonedImgs[i].src = (img as HTMLImageElement).src;
        }
    });

    document.body.appendChild(printMount);
    document.body.classList.add('is-printing');

    // ── 2. Trigger Print ────────────────────────────────────────────
    const monitorImagesAndPrint = async () => {
        const images = Array.from(printMount.querySelectorAll('img'));
        
        // Wait for all images to be 'complete'
        await Promise.all(images.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
                img.onload = resolve;
                img.onerror = resolve; // Continue regardless
            });
        }));

        // Final buffer for rendering engine
        await new Promise(r => setTimeout(r, 500));
        
        window.print();
        
        // ── 3. Cleanup ─────────────────────────────────────────────
        setTimeout(() => {
            document.body.classList.remove('is-printing');
            if (document.getElementById('print-mount')) {
                document.body.removeChild(printMount);
            }
        }, 1500); 
    };

    // Initial settle time for DOM injection
    setTimeout(monitorImagesAndPrint, 500);
}
