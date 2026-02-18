import puppeteer from 'puppeteer';

const devices = [
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'iPhone 12 Pro', width: 390, height: 844 },
  { name: 'iPad', width: 768, height: 1024 },
  { name: 'iPad Pro', width: 1024, height: 1366 },
  { name: 'Desktop', width: 1280, height: 800 },
  { name: 'Desktop Large', width: 1920, height: 1080 }
];

async function testResponsive() {
  const browser = await puppeteer.launch({ 
    headless: 'new',
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  for (const device of devices) {
    const page = await browser.newPage();
    await page.setViewport({ width: device.width, height: device.height });
    await page.goto('https://3000-ij386zz21mip7olzipps0-88fc9915.us2.manus.computer/', { waitUntil: 'networkidle0' });
    
    // Скриншот
    await page.screenshot({ 
      path: `/home/ubuntu/screenshots/responsive-${device.name.replace(/\s/g, '-')}.png`,
      fullPage: false
    });
    
    console.log(`✓ ${device.name} (${device.width}x${device.height}) - screenshot saved`);
    await page.close();
  }
  
  await browser.close();
  console.log('\nAll responsive tests completed!');
}

testResponsive().catch(console.error);
