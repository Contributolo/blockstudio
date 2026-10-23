import { expect, test, type Page } from '@playwright/test';

test.use({ screenshot: 'only-on-failure', trace: 'retain-on-failure' });

function section(page: Page, name: string) {
  return page
    .getByRole('heading', { name, exact: true })
    .locator('xpath=ancestor::*[@data-bsui-stack][1]');
}

for (const width of [390, 1280]) {
  test.describe(`showcase ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test.beforeEach(async ({ page }) => {
      await page.goto('/showcase/');
      await expect(page.locator('[data-app-kitchen-sink]')).toBeVisible();
    });

    test('card fields have one inset content surface and aligned header spacing', async ({
      page,
    }, testInfo) => {
      const card = page.locator('[data-bsui-field-group][data-variant="card"]');
      const content = card.locator('[data-bsui-field-group-content]');
      await expect(content).toHaveCount(1);
      await expect(
        content.getByPlaceholder('Enter display name'),
      ).toBeVisible();
      const geometry = await card.evaluate((element) => {
        const frame = element.querySelector('[data-bsui-field-group-content]')!;
        const box = element.getBoundingClientRect();
        const body = frame.getBoundingClientRect();
        return {
          left: body.left - box.left,
          right: box.right - body.right,
          bottom: box.bottom - body.bottom,
          radius: parseFloat(getComputedStyle(element).borderRadius),
          background: getComputedStyle(element).backgroundColor,
          frame: getComputedStyle(frame).backgroundColor,
          overflow: element.scrollWidth - element.clientWidth,
        };
      });
      expect(geometry.left).toBeCloseTo(5, 0);
      expect(geometry.right).toBeCloseTo(5, 0);
      expect(geometry.bottom).toBeCloseTo(5, 0);
      expect(geometry.radius).toBeLessThanOrEqual(8);
      expect(geometry.background).not.toBe(geometry.frame);
      expect(geometry.overflow).toBeLessThanOrEqual(1);
      await card.screenshot({ path: testInfo.outputPath('field-card.png') });
      await page
        .locator('[data-bsui-field-group][data-variant="default"]')
        .screenshot({ path: testInfo.outputPath('field-group.png') });
    });

    test('toolbar separators span the complete inner height without enlarging the toolbar', async ({
      page,
    }, testInfo) => {
      const toolbar = page.locator('[data-bsui-toolbar-root]');
      await toolbar.scrollIntoViewIfNeeded();
      const geometry = await toolbar.evaluate((element) => {
        const root = element.getBoundingClientRect();
        return {
          width: root.width,
          separators: [
            ...element.querySelectorAll('[data-bsui-toolbar-separator]'),
          ].map((separator) => {
            const box = separator.getBoundingClientRect();
            return {
              width: box.width,
              top: box.top - root.top,
              bottom: root.bottom - box.bottom,
            };
          }),
        };
      });
      expect(geometry.separators).toHaveLength(3);
      expect(geometry.width).toBeLessThanOrEqual(width);
      for (const separator of geometry.separators) {
        expect(separator.width).toBe(1);
        expect(separator.top).toBeCloseTo(1, 0);
        expect(separator.bottom).toBeCloseTo(1, 0);
      }
      await toolbar.screenshot({ path: testInfo.outputPath('toolbar.png') });
    });

    test('controlled checkbox, switch and toggle update their owner and form values', async ({
      page,
    }) => {
      const checkbox = page.locator(
        '[data-wp-on--click="app/kitchen-sink::actions.setCheckbox"]',
      );
      await expect(checkbox).toHaveAttribute('aria-checked', 'true');
      await checkbox.click();
      await expect(page.locator('#ks-checkbox')).toHaveText('false');
      await expect(page.locator('input[name="terms"]')).toHaveValue('');
      await checkbox.click();
      await expect(page.locator('input[name="terms"]')).toHaveValue('on');
      const switchControl = section(page, 'Switch').getByRole('switch', {
        name: 'Airplane Mode',
        exact: true,
      });
      await switchControl.click();
      await expect(page.locator('#ks-switch')).toHaveText('true');
      await expect(page.locator('input[name="airplane"]')).toHaveValue('on');
      const toggle = section(page, 'Toggle').getByRole('button', {
        name: 'Bold',
        exact: true,
      });
      await toggle.click();
      await expect(page.locator('#ks-toggle')).toHaveText('true');
      await page
        .getByRole('button', { name: 'Reset controlled values' })
        .click();
      await expect(checkbox).toHaveAttribute('aria-checked', 'false');
      await expect(switchControl).toHaveAttribute('aria-checked', 'false');
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await expect(page.locator('input[name="terms"]')).toHaveValue('');
      await expect(page.locator('input[name="airplane"]')).toHaveValue('');
    });

    test('native controlled fields preserve typing and follow parent empty values', async ({
      page,
    }) => {
      const fields = [
        {
          heading: 'Input',
          selector: 'input',
          output: '#ks-input',
          value: 'qa@example.test',
        },
        {
          heading: 'Textarea',
          selector: 'textarea',
          output: '#ks-textarea',
          value: 'Updated message',
        },
        {
          heading: 'Password Input',
          selector: 'input',
          output: '#ks-password',
          value: 'test-password',
        },
      ];
      for (const field of fields) {
        const input = section(page, field.heading).locator(field.selector);
        await input.fill(field.value);
        await expect(page.locator(field.output)).toHaveText(field.value);
        await expect(input).toHaveValue(field.value);
      }
      await page
        .getByRole('button', { name: 'Reset controlled values' })
        .click();
      for (const field of fields) {
        await expect(
          section(page, field.heading).locator(field.selector),
        ).toHaveValue('');
        await expect(page.locator(field.output)).toBeEmpty();
      }
    });

    test('number and slider reflect parent zero and remain numeric afterwards', async ({
      page,
    }) => {
      const number = section(page, 'Number Field');
      await number.getByRole('button', { name: 'Increase' }).click();
      await number.getByRole('button', { name: 'Increase' }).click();
      await expect(page.locator('#ks-number')).toHaveText('7');
      const slider = section(page, 'Slider').getByRole('slider');
      await slider.focus();
      await page.keyboard.press('End');
      await expect(page.locator('#ks-slider')).toHaveText('100');
      await page
        .getByRole('button', { name: 'Reset controlled values' })
        .click();
      await expect(number.getByRole('spinbutton')).toHaveValue('0');
      await expect(slider).toHaveAttribute('aria-valuenow', '0');
      await number.getByRole('button', { name: 'Increase' }).click();
      await expect(number.getByRole('spinbutton')).toHaveValue('1');
      await slider.focus();
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('#ks-slider')).toHaveText('1');
    });

    test('controlled number and time fields preserve multi-digit typing', async ({
      page,
    }) => {
      const number = section(page, 'Number Field').getByRole('spinbutton');
      await number.fill('8');
      await number.press('Tab');
      await expect(page.locator('#ks-number')).toHaveText('8');
      await expect(number).toHaveValue('8');
      const time = section(page, 'Time Picker');
      const hour = time.getByRole('textbox', { name: 'Hours' });
      const minute = time.getByRole('textbox', { name: 'Minutes' });
      await hour.focus();
      await hour.selectText();
      await page.keyboard.type('09', { delay: 50 });
      await expect(minute).toBeFocused();
      await page.keyboard.type('45', { delay: 50 });
      await expect(hour).toHaveValue('09');
      await expect(minute).toHaveValue('45');
      await expect(page.locator('#ks-time')).toHaveText('09:45');
      await minute.press('Tab');
      await expect(page.locator('#ks-time')).toHaveText('09:45');
      await hour.fill('1');
      await hour.press('Tab');
      await expect(page.locator('#ks-time')).toHaveText('01:45');
      await minute.fill('');
      await minute.press('Tab');
      await expect(page.locator('#ks-time')).toBeEmpty();
      await expect(time.locator('input[type="hidden"]')).toHaveValue('');
    });

    test('radio and rating follow parent clears instead of retaining old selections', async ({
      page,
    }) => {
      const radio = section(page, 'Radio');
      await radio.getByRole('radio', { name: 'Compact', exact: true }).click();
      await expect(page.locator('#ks-radio')).toHaveText('compact');
      const rating = section(page, 'Rating');
      await rating.getByRole('radio', { name: '5 stars', exact: true }).click();
      await expect(page.locator('#ks-rating')).toHaveText('5');
      await page
        .getByRole('button', { name: 'Reset controlled values' })
        .click();
      await expect(radio.locator('[aria-checked="true"]')).toHaveCount(0);
      await expect(rating.locator('[data-filled]')).toHaveCount(0);
      await expect(rating.locator('input[type="hidden"]')).toHaveValue('0');
    });

    test('color and time controls synchronize every instance and parent resets', async ({
      page,
    }) => {
      const color = section(page, 'Color Picker').locator('input[type="text"]');
      await color.fill('#ff0000');
      await expect(page.locator('#ks-color')).toHaveText('#ff0000');
      const allColors = page.locator(
        '[data-bsui-color-picker] input[type="color"]',
      );
      for (const input of await allColors.all())
        await expect(input).toHaveValue('#ff0000');
      const time = section(page, 'Time Picker');
      await time.getByRole('textbox', { name: 'Hours' }).focus();
      await page.keyboard.press('ArrowUp');
      await expect(page.locator('#ks-time')).toHaveText('15:30');
      await page
        .getByRole('button', { name: 'Reset controlled values' })
        .click();
      await expect(color).toHaveValue('#000000');
      for (const input of await allColors.all())
        await expect(input).toHaveValue('#000000');
      await expect(time.getByRole('textbox', { name: 'Hours' })).toHaveValue(
        '00',
      );
      await expect(time.getByRole('textbox', { name: 'Minutes' })).toHaveValue(
        '00',
      );
      await expect(time.locator('input[type="hidden"]')).toHaveValue('00:00');
    });

    test('menubar and submenu items use the standard menu row spacing', async ({
      page,
    }, testInfo) => {
      const menu = section(page, 'Menubar').locator('[data-bsui-menubar]');
      await menu.locator('[data-bsui-menubar-trigger]').first().click();
      const item = menu.getByRole('menuitem', { name: 'New Tab', exact: true });
      await expect(item).toHaveCSS('min-height', '36px');
      await expect(item).toHaveCSS('padding-left', '12px');
      await expect(item).toHaveCSS('font-size', '14px');
      await menu.locator('[data-bsui-menubar-submenu-trigger]').hover();
      const nested = menu.getByRole('menuitem', { name: 'PDF', exact: true });
      await expect(nested).toBeVisible();
      await expect(nested).toHaveCSS('min-height', '36px');
      await expect(nested).toHaveCSS('padding-left', '12px');
      await page.screenshot({ path: testInfo.outputPath('menubar-open.png') });
    });

    test('select, phone, date and OTP publish their actual edited values', async ({
      page,
    }) => {
      const select = section(page, 'Select')
        .locator('[data-bsui-select-root]')
        .first();
      await select.locator('[data-bsui-select-trigger]').click();
      await select.getByRole('option', { name: 'Banana', exact: true }).click();
      await expect(page.locator('#ks-select')).toHaveText('banana');
      const phone = section(page, 'Phone Input');
      await phone.locator('input[type="tel"]').fill('5551234567');
      await expect(page.locator('#ks-phone')).not.toBeEmpty();
      await expect(page.locator('#ks-phone')).toHaveText(
        await phone.locator('input[type="hidden"]').inputValue(),
      );
      const otp = section(page, 'OTP Input');
      await otp.locator('input[data-index]').first().focus();
      await page.keyboard.type('123456');
      await expect(page.locator('#ks-otp')).toHaveText('123456');
      const date = section(page, 'Date Input');
      await date.locator('input[type="text"]').fill('2026-10-21');
      await date.locator('input[type="text"]').press('Tab');
      await expect(page.locator('#ks-date')).not.toBeEmpty();
    });
  });
}
