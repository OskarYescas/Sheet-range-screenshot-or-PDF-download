# Google Sheets Smart Export Guide

This tool provides a **high-fidelity, whitespace-free export** solution for Google Sheets ranges. It bypasses the limitations of the native export function by using client-side rendering and intelligent cropping.

---
> [!IMPORTANT]
>**IMPORTANT DISCLAIMER**: This solution offers a recommended approach that is not exhaustive and is not intended as a final enterprise-ready solution. Customers should consult their Dev, security, and networking teams before deployment.
---

## 📋 Prerequisites

To use this tool effectively, ensure you have the following:
* **Google Sheets Access:** A spreadsheet where the script is installed.
* **Permissions:** Authorization to run Apps Script within your Google Workspace.
* **Browser:** A modern web browser (Chrome, Firefox, or Edge) with pop-ups enabled for downloads.

---

## 📖 Description

The **Smart Export Tool** is designed to solve the common "extra whitespace" and "low resolution" issues found in native Google Sheets exports. By combining `pdf.js` for rendering and `jsPDF` for file generation, it captures exactly what you see on your screen without unnecessary margins.

---

## 🚀 Features

* **Pixel-Perfect Accuracy:** Captures your selection exactly as it appears, including vector fonts, colors, and complex charts.
* **Zero Whitespace:** Automatically scans the image and **crops out empty white space** from the bottom for both PDF and PNG formats.
* **Retina Quality:** Exports are rendered at **2x resolution** by default for crisp text and sharp lines.
* **Direct-to-PDF:** Generates a PDF that matches the PNG pixel-for-pixel, avoiding inconsistent padding.

---

## 🛠️ How It Works

1.  **Selection:** You select a range of cells (e.g., `A1:H30`).
2.  **Server Fetch:** The script requests a high-quality vector PDF of that range from Google Sheets.
3.  **Client Render:** Your browser receives the PDF and renders it onto an HTML5 Canvas using `pdf.js`.
4.  **Smart Crop:** A custom algorithm scans the canvas from the bottom up to detect exactly where the content ends.
5.  **Final Generation:**
    * **For PNG:** The cropped canvas is saved directly as an image.
    * **For PDF:** The cropped image is embedded into a brand-new PDF file using `jsPDF`.

---

## 🚀 Deployment Guide & Usage

### Usage Instructions
1.  **Open** your Google Sheet.
2.  **Select** the cells you want to capture (ensure charts are within the selection).
3.  Click the **📷 Capture** menu in the toolbar.
4.  **Choose your format:**
    * *Download Selection as PDF*
    * *Download Selection as PNG* 
5.  **Wait** for the "Processing..." dialog to finish (usually 2-5 seconds).
6.  The file will **automatically download** to your computer.

---

## 💡 Use Case: Configuration (Advanced)

The script is built to "Enterprise Standard" with a clear code structure. If you need to adjust the export quality, follow these steps:

1.  **Open Script Editor:** Navigate to `Extensions` > `Apps Script`.
2.  **Adjust Resolution:** Locate `const scale = 2;` within the `generateHtmlDialog` function.
    * `scale = 1`: Standard Web Resolution (faster, smaller file).
    * `scale = 2`: Retina / High Quality (**Default**).
    * `scale = 3+`: Print / Poster Quality (larger file size).

---

## ❓ Troubleshooting

* **"Please select a range first!":** Ensure you have highlighted cells before clicking the menu.
* **Empty Output:** The Smart Crop stops at non-white pixels. Ensure your background is truly transparent or white.
* **Pop-up Blocker:** Your browser needs to allow the download. If nothing happens, check the address bar for a blocked pop-up icon.
