<?php
wp_interactivity_state( 'interaction/controlled-bindings', array( 'count' => 2 ) );
?>
<div data-wp-interactive="interaction/controlled-bindings" data-controlled-bindings>
	<bs:bsui-number-field nameAlt="first-count" value="interaction/controlled-bindings::state.count" onChange="interaction/controlled-bindings::actions.setCount" />
	<bs:bsui-number-field nameAlt="second-count" value="interaction/controlled-bindings::state.count" onChange="interaction/controlled-bindings::actions.setCount" />
	<bs:bsui-number-field nameAlt="independent-count" defaultValue="9" />
	<div data-wp-on--click="actions.reset"><bs:bsui-button label="Reset shared count" /></div>
	<output data-wp-text="state.count"></output>
</div>
