import { expect, test } from '@playwright/test';

test('state bindings update every controlled instance without changing independent controls', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/controlled-bindings-test/');
  const inputs = page.getByRole('spinbutton');
  await expect(inputs.nth(0)).toHaveValue('2');
  await expect(inputs.nth(1)).toHaveValue('2');
  await expect(inputs.nth(2)).toHaveValue('9');
  await expect(inputs.nth(0)).not.toHaveAttribute('aria-valuemin');
  await expect(inputs.nth(0)).not.toHaveAttribute('aria-valuemax');
  await page
    .getByRole('button', { name: 'Increase', exact: true })
    .first()
    .click();
  await expect(inputs.nth(0)).toHaveValue('3');
  await expect(inputs.nth(1)).toHaveValue('3');
  await expect(page.locator('output')).toHaveText('3');
  await page.getByRole('button', { name: 'Reset shared count' }).click();
  await expect(inputs.nth(0)).toHaveValue('0');
  await expect(inputs.nth(1)).toHaveValue('0');
  await expect(inputs.nth(2)).toHaveValue('9');
  await page
    .getByRole('button', { name: 'Decrease', exact: true })
    .nth(2)
    .click();
  await expect(inputs.nth(2)).toHaveValue('8');
  await expect(inputs.nth(0)).toHaveValue('0');
  expect(errors).toEqual([]);
});
