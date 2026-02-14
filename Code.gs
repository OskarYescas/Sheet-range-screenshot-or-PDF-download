/**
 * @fileoverview Enhanced Google Sheets Export Tool
 * This script provides functionality to export a selected range of cells as either
 * a high-quality PDF or PNG image. It leverages client-side rendering libraries
 * (PDF.js and jsPDF) to ensure pixel-perfect output and features intelligent
 * whitespace trimming ("Smart Crop").
 * 
 * Features:
 * - Direct PDF Export (via client-side generation for fidelity)
 * - Direct PNG Export (with auto-crop)
 * - Custom page size calculation based on selection dimensions
 * - 96 DPI standard
 */

const UI = SpreadsheetApp.getUi();

/**
 * Trigger function that runs when the spreadsheet is opened.
 * Adds a custom menu to the Google Sheets UI.
 */
function onOpen() {
    UI.createMenu('📷 Capture')
        .addItem('Download Selection as PDF', 'triggerPdfDownload')
        .addItem('Download Selection as PNG', 'triggerPngDownload')
        .addToUi();
}

/**
 * Entry point for PDF download workflow.
 */
function triggerPdfDownload() {
    processExport(0); // Mode 0 = PDF
}

/**
 * Entry point for PNG download workflow.
 */
function triggerPngDownload() {
    processExport(1); // Mode 1 = PNG
}

/**
 * Core function to handle the export process.
 * 1. Calculates the dimensions of the selected range.
 * 2. Fetches a server-generated PDF blob from Google Sheets.
 * 3. Opens a client-side dialog to render, crop, and save the file.
 *
 * @param {number} mode - The export mode: 0 for PDF, 1 for PNG.
 */
function processExport(mode) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getActiveSheet();
    const range = ss.getActiveRange();

    if (!range) {
        UI.alert("Please select a range of cells first.");
        return;
    }

    try {
        // --- 1. Calculate Exact Dimensions ---
        let totalWidth = 0;
        let totalHeight = 0;

        // Sum column widths
        for (let col = range.getColumn(); col <= range.getLastColumn(); col++) {
            totalWidth += sheet.getColumnWidth(col);
        }

        // Sum row heights
        for (let row = range.getRow(); row <= range.getLastRow(); row++) {
            totalHeight += sheet.getRowHeight(row);
        }

        // Convert pixels to inches (Standard Web DPI: 96)
        // Adding a tiny buffer (0.05) to prevent border clipping
        const widthInInches = (totalWidth / 96 + 0.05).toFixed(2);
        const heightInInches = (totalHeight / 96 + 0.05).toFixed(2);

        // Determine orientation based on aspect ratio
        const isPortrait = parseFloat(heightInInches) > parseFloat(widthInInches);

        // Get IDs for URL construction
        const ssId = ss.getId();
        const sheetId = sheet.getSheetId();

        // --- 2. Construct Export URL ---
        // We request a custom page size matching the content exactly.
        // Scale=4 (Fit to Page) ensures the content fills this custom size.
        const url = `https://docs.google.com/spreadsheets/d/${ssId}/export?` +
            `format=pdf` +
            `&gid=${sheetId}` +
            `&r1=${range.getRow() - 1}&c1=${range.getColumn() - 1}` +
            `&r2=${range.getLastRow()}&c2=${range.getLastColumn()}` +
            `&size=custom&psize=${widthInInches}x${heightInInches}` +
            `&portrait=${isPortrait}` +
            `&scale=4` + // Fit to Page
            `&gridlines=false&printtitle=false&sheetnames=false` +
            `&top_margin=0&bottom_margin=0&left_margin=0&right_margin=0` +
            `&hcen=true&vcen=true`;

        // Fetch the PDF blob using the user's OAuth token
        const response = UrlFetchApp.fetch(url, {
            headers: {
                'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
            },
            muteHttpExceptions: true
        });

        if (response.getResponseCode() !== 200) {
            throw new Error(`Export failed (Status ${response.getResponseCode()})`);
        }

        const pdfBlobBase64 = Utilities.base64Encode(response.getBlob().getBytes());

        // --- 3. Generate Client-Side Dialog ---
        // Includes custom HTML/JS for rendering and processing the image/pdf
        const htmlContent = generateHtmlDialog(pdfBlobBase64, mode);

        const dialogTitle = mode === 1 ? 'Generating PNG...' : 'Generating PDF...';
        const dialogHeight = mode === 1 ? 250 : 180; // Larger for PNG preview
        const dialogWidth = mode === 1 ? 400 : 300;

        UI.showModalDialog(
            HtmlService.createHtmlOutput(htmlContent).setHeight(dialogHeight).setWidth(dialogWidth),
            dialogTitle
        );

    } catch (e) {
        UI.alert("Error occurred: " + e.message);
        console.error(e);
    }
}

/**
 * Generates the HTML string for the modal dialog.
 * This contains the client-side JavaScript to:
 * 1. Render the PDF to a canvas using PDF.js
 * 2. Perform "Smart Crop" to trim whitespace
 * 3. Generate the final download (PNG or PDF via jsPDF)
 *
 * @param {string} pdfBase64 - The base64 encoded string of the source PDF.
 * @param {number} mode - The export mode (0=PDF, 1=PNG).
 * @return {string} The complete HTML string.
 */
function generateHtmlDialog(pdfBase64, mode) {
    // We use template literals for readability here, but the output is served to the client.
    return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: 'Google Sans', Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; text-align: center; }
          #status { margin-top: 15px; font-weight: 500; color: #333; }
          .spinner { width: 30px; height: 30px; border: 4px solid #f3f3f3; border-top: 4px solid #1a73e8; border-radius: 50%; animation: spin 1s linear infinite; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          /* Hidden canvas is used for processing */
          canvas { display: none; }
        </style>
        
        <!-- Libraries: PDF.js for rendering, jsPDF for PDF creation -->
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
        
        <script>
          // Configure PDF.js worker
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

          // Base64 data from server
          const pdfDataShort = "${pdfBase64}";
          const exportMode = ${mode}; // 0=PDF, 1=PNG

          /**
           * Main execution function called on load.
           */
          function startProcessing() {
            updateStatus('Initializing...');
            
            // Decode base64
            const pdfData = atob(pdfDataShort);
            
            // Load PDF document
            pdfjsLib.getDocument({data: pdfData}).promise.then(function(pdf) {
              updateStatus('Rendering content...');
              
              // Fetch first page
              pdf.getPage(1).then(function(page) {
                // Set scale to 2x for High Quality / Retina output
                const scale = 2; 
                const viewport = page.getViewport({scale: scale});

                // Prepare canvas
                const canvas = document.getElementById('render-canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                // Render page
                const renderContext = {
                  canvasContext: context,
                  viewport: viewport
                };
                
                page.render(renderContext).promise.then(function() {
                  updateStatus('Applying Smart Crop...');
                  
                  // Perform Smart Crop
                  const processedCanvas = performSmartCrop(canvas);
                  const imageDataUrl = processedCanvas.toDataURL('image/png');

                  downloadOutput(imageDataUrl, processedCanvas.width, processedCanvas.height);
                });
              });
            }).catch(function(error) {
              console.error('Error:', error);
              updateStatus('Error: ' + error.message);
            });
          }

          /**
           * Handles the file generation and download triggering.
           */
          function downloadOutput(imgData, width, height) {
            updateStatus('Downloading...');
            
            if (exportMode === 1) { 
              // --- PNG Mode ---
              triggerDownload(imgData, 'Range_Capture.png');
            } else { 
              // --- PDF Mode ---
              // Initialize jsPDF
              const { jsPDF } = window.jspdf;
              
              // Create PDF matching image dimensions (converted to points/px)
              const pdf = new jsPDF({
                orientation: height > width ? 'p' : 'l',
                unit: 'px',
                format: [width, height]
              });
              
              // Add image to PDF (0,0 coordinate, full width/height)
              pdf.addImage(imgData, 'PNG', 0, 0, width, height);
              pdf.save('Range_Capture.pdf');
            }
            
            updateStatus('Done!');
            // Close dialog after short delay
            setTimeout(function() { google.script.host.close(); }, 2000);
          }

          /**
           * Scans the canvas from bottom-up to remove empty whitespace.
           * @param {HTMLCanvasElement} sourceCanvas
           * @return {HTMLCanvasElement} A new, cropped canvas
           */
          function performSmartCrop(sourceCanvas) {
            const ctx = sourceCanvas.getContext('2d');
            const width = sourceCanvas.width;
            const height = sourceCanvas.height;
            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data; // Pixel array [r,g,b,a, r,g,b,a...]
            
            let cropBottom = height;
            let foundContent = false;

            // Scan rows from bottom to top
            for (let y = height - 1; y >= 0; y--) {
              for (let x = 0; x < width; x++) {
                const index = (y * width + x) * 4;
                const r = data[index];
                const g = data[index+1];
                const b = data[index+2];
                const a = data[index+3];
                
                // Content detection logic:
                // Pixel is NOT transparent AND NOT white (allowing for slight anti-aliasing noise)
                // Threshold: 250 (very close to white 255)
                const isWhite = r > 250 && g > 250 && b > 250;
                
                if (a !== 0 && !isWhite) {
                  cropBottom = y + 1;
                  foundContent = true;
                  break; 
                }
              }
              if (foundContent) break;
            }

            // Return original if blank (safety check)
            if (!foundContent) return sourceCanvas;

            // Create cropped canvas
            const resultCanvas = document.createElement('canvas');
            resultCanvas.width = width;
            resultCanvas.height = cropBottom;
            
            // Draw cropped region
            resultCanvas.getContext('2d').drawImage(
              sourceCanvas, 
              0, 0, width, cropBottom, // Source Rect
              0, 0, width, cropBottom  // Dest Rect
            );
            
            return resultCanvas;
          }

          // Trigger download helper
          function triggerDownload(url, filename) {
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }

          function updateStatus(msg) {
            document.getElementById('status').textContent = msg;
          }
        </script>
      </head>
      <body onload="startProcessing()">
        <div class="spinner"></div>
        <div id="status">Initializing...</div>
        <canvas id="render-canvas"></canvas>
      </body>
    </html>
  `;
}
