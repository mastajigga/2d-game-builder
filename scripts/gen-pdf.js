const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const filePath = require('path').resolve(__dirname, '../docs/roadmap.html');
  await page.goto('file://' + filePath);
  await page.pdf({
    path: 'docs/Roadmap_Orion_Sirius.pdf',
    format: 'A4',
    margin: { top: '2cm', bottom: '2cm', left: '2cm', right: '2cm' },
    printBackground: true,
  });
  await browser.close();
  console.log('PDF generated: docs/Roadmap_Orion_Sirius.pdf');
})();
