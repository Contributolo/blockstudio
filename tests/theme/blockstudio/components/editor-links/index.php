<?php if ( 'innerblocks' === $a['root'] ) : ?>
  <InnerBlocks useBlockProps tag="section" class="editor-links-innerblocks" template='[["blockstudio/component-editor-links"]]' />
<?php elseif ( 'richtext' === $a['root'] ) : ?>
  <RichText useBlockProps attribute="text" tag="p" class="editor-links-richtext" />
<?php elseif ( 'anchor' === $a['root'] ) : ?>
  <a useBlockProps href="<?php echo esc_url( home_url( '/?blockstudio-editor-link=root' ) ); ?>" class="editor-links">
    <span data-editor-link="root">Root link</span>
  </a>
<?php else : ?>
  <section <?php if ( 'props' === $a['root'] ) : ?>useBlockProps<?php endif; ?> class="editor-links">
    <a href="<?php echo esc_url( home_url( '/?blockstudio-editor-link=normal' ) ); ?>"><span data-editor-link="normal">Normal link</span></a>
    <a href="<?php echo esc_url( home_url( '/?blockstudio-editor-link=blank' ) ); ?>" target="_blank" rel="noopener"><span data-editor-link="blank">New tab link</span></a>
    <a href="<?php echo esc_url( home_url( '/?blockstudio-editor-link=icon' ) ); ?>"><svg width="24" height="24" viewBox="0 0 24 24"><path data-editor-link="icon" d="M2 2h20v20H2z" /></svg></a>
    <a href="#editor-link-fragment"><span data-editor-link="fragment">Fragment link</span></a>
    <RichText attribute="text" tag="p" />
  </section>
<?php endif; ?>
