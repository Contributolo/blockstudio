import { test, expect } from '@playwright/test';

test.describe( 'bsui/toolbar', () => {
	test.beforeEach( async ( { page } ) => {
		await page.goto( '/toolbar-test/' );
		await page.waitForSelector( '[role="toolbar"]' );
	} );

	test( 'renders toolbar', async ( { page } ) => {
		await expect( page.locator( '[role="toolbar"]' ) ).toBeVisible();
	} );

	test( 'has role=toolbar', async ( { page } ) => {
		await expect( page.locator( '[role="toolbar"]' ) ).toHaveAttribute( 'role', 'toolbar' );
	} );

	test( 'has aria-orientation', async ( { page } ) => {
		await expect( page.locator( '[role="toolbar"]' ) ).toHaveAttribute( 'aria-orientation', 'horizontal' );
	} );

	test( 'renders buttons', async ( { page } ) => {
		const buttons = page.locator( '[role="toolbar"] button' );
		await expect( buttons ).toHaveCount( 6 );
	} );

	test( 'selected toolbar toggles have a distinct fill without a border or shadow', async ( { page } ) => {
		const toolbar = page.getByRole( 'toolbar' );
		const left = toolbar.getByRole( 'button', { name: 'Left', exact: true } );
		const center = toolbar.getByRole( 'button', { name: 'Center', exact: true } );
		await expect( left ).toHaveAttribute( 'aria-pressed', 'true' );
		await expect( left ).toHaveCSS( 'box-shadow', 'none' );
		const surface = await toolbar.evaluate( element => getComputedStyle( element ).backgroundColor );
		await expect( left ).not.toHaveCSS( 'background-color', surface );
		await center.click();
		await expect( center ).toHaveAttribute( 'aria-pressed', 'true' );
		await expect( center ).toHaveCSS( 'box-shadow', 'none' );
		await expect( left ).toHaveAttribute( 'aria-pressed', 'false' );
		await expect( left ).toHaveCSS( 'box-shadow', 'none' );
	} );

	test( 'ArrowRight moves focus', async ( { page } ) => {
		const buttons = page.locator( '[role="toolbar"] button' );
		await buttons.first().focus();
		await page.keyboard.press( 'ArrowRight' );
		await expect( buttons.nth( 1 ) ).toBeFocused();
	} );

	test( 'Home moves to first', async ( { page } ) => {
		const buttons = page.locator( '[role="toolbar"] button' );
		await buttons.nth( 2 ).focus();
		await page.keyboard.press( 'Home' );
		await expect( buttons.first() ).toBeFocused();
	} );

	test( 'End moves to last', async ( { page } ) => {
		const buttons = page.locator( '[role="toolbar"] button' );
		await buttons.first().focus();
		await page.keyboard.press( 'End' );
		await expect( buttons.last() ).toBeFocused();
	} );

	test( 'vertical toolbar separators span its width and keyboard navigation follows orientation', async ( { page } ) => {
		await page.goto( '/toolbar-vertical-test/' );
		const toolbar = page.getByRole( 'toolbar' );
		await expect( toolbar ).toHaveAttribute( 'aria-orientation', 'vertical' );
		const separator = toolbar.getByRole( 'separator' );
		await expect( separator ).toHaveAttribute( 'aria-orientation', 'horizontal' );
		const rootBox = ( await toolbar.boundingBox() )!;
		const separatorBox = ( await separator.boundingBox() )!;
		expect( separatorBox.height ).toBe( 1 );
		expect( separatorBox.x - rootBox.x ).toBeCloseTo( 1, 0 );
		expect( rootBox.width - separatorBox.width ).toBeCloseTo( 2, 0 );
		await toolbar.getByRole( 'button', { name: 'Cut', exact: true } ).focus();
		await page.keyboard.press( 'ArrowDown' );
		await expect( toolbar.getByRole( 'button', { name: 'Copy', exact: true } ) ).toBeFocused();
	} );
} );
