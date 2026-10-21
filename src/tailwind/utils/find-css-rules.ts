export const findCssRules = (selector: string): string[] => {
  const stylesheets = document.styleSheets;

  const rulesList: string[] = [];

  const visit = (rules: CSSRuleList) => {
    for (let j = 0; j < rules.length; j++) {
      const rule = rules[j];

      if (rule.type === CSSRule.STYLE_RULE) {
        const styleRule = rule as CSSStyleRule;
        if (styleRule.selectorText) {
          const matchedSelectors = styleRule.selectorText
            .split(',')
            .map((s) => s.trim());
          if (matchedSelectors.includes(selector)) {
            rulesList.push(styleRule.cssText);
          }
        }
      }
      if ('cssRules' in rule) visit((rule as CSSGroupingRule).cssRules);
    }
  };

  for (let i = 0; i < stylesheets.length; i++) {
    try {
      visit(stylesheets[i].cssRules);
    } catch {
      // Browsers deny CSSOM reads for cross-origin stylesheets.
    }
  }

  return rulesList;
};
