<section useBlockProps class="editor-audit" data-audit-post-id="<?php echo esc_attr( $block['postId'] ); ?>" data-audit-meta="<?php echo esc_attr( get_post_meta( $block['postId'], '_editor_audit', true ) ); ?>">
  <RichText attribute="richtext" tag="p" placeholder="Audit rich text" />
  <span data-audit-field><?php echo esc_html( $a['text'] ); ?></span>
  <InnerBlocks templateLock="false" allowedBlocks='["core/paragraph"]' template='[["core/paragraph", {"content": "Unlocked paragraph"}]]' />
</section>
