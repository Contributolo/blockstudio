<block name="bsui/dialog">
	<block name="bsui/dialog-trigger" trigger_label="Open Editor"></block>
	<block name="bsui/dialog-backdrop"></block>
	<block name="bsui/dialog-popup">
		<h3>Editor</h3>
		<p>Make your changes, then save them.</p>
		<block name="bsui/dialog-footer">
			<block name="bsui/tooltip" openDelay="0">
				<block name="bsui/tooltip-trigger" trigger_label="Save"></block>
				<block name="bsui/tooltip-popup" content="Saves your changes"></block>
			</block>
		</block>
		<block name="bsui/dialog-close" label="Close"></block>
	</block>
</block>
