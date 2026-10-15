<?php

declare (strict_types=1);
/*
 * This file is part of the league/commonmark package.
 *
 * (c) Colin O'Dell <colinodell@gmail.com>
 *
 * Original code based on the CommonMark JS reference parser (https://bitly.com/commonmark-js)
 *  - (c) John MacFarlane
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
namespace BlockstudioVendor\League\CommonMark\Extension\CommonMark\Renderer\Inline;

use BlockstudioVendor\League\CommonMark\Extension\CommonMark\Node\Inline\HtmlInline;
use BlockstudioVendor\League\CommonMark\Node\Node;
use BlockstudioVendor\League\CommonMark\Renderer\ChildNodeRendererInterface;
use BlockstudioVendor\League\CommonMark\Renderer\NodeRendererInterface;
use BlockstudioVendor\League\CommonMark\Util\HtmlFilter;
use BlockstudioVendor\League\CommonMark\Xml\XmlNodeRendererInterface;
use BlockstudioVendor\League\Config\ConfigurationAwareInterface;
use BlockstudioVendor\League\Config\ConfigurationInterface;
final class HtmlInlineRenderer implements NodeRendererInterface, XmlNodeRendererInterface, ConfigurationAwareInterface
{
    /** @psalm-readonly-allow-private-mutation */
    private ConfigurationInterface $config;
    /**
     * @param HtmlInline $node
     *
     * {@inheritDoc}
     *
     * @psalm-suppress MoreSpecificImplementedParamType
     */
    public function render(Node $node, ChildNodeRendererInterface $childRenderer): string
    {
        HtmlInline::assertInstanceOf($node);
        $htmlInput = $this->config->get('html_input');
        return HtmlFilter::filter($node->getLiteral(), $htmlInput);
    }
    public function setConfiguration(ConfigurationInterface $configuration): void
    {
        $this->config = $configuration;
    }
    public function getXmlTagName(Node $node): string
    {
        return 'html_inline';
    }
    /**
     * {@inheritDoc}
     */
    public function getXmlAttributes(Node $node): array
    {
        return [];
    }
}
