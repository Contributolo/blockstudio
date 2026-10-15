<?php

declare (strict_types=1);
/*
 * This file is part of the league/commonmark package.
 *
 * (c) Colin O'Dell <colinodell@gmail.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
namespace BlockstudioVendor\League\CommonMark\Environment;

use BlockstudioVendor\League\CommonMark\Delimiter\Processor\DelimiterProcessorCollection;
use BlockstudioVendor\League\CommonMark\Extension\ExtensionInterface;
use BlockstudioVendor\League\CommonMark\Node\Node;
use BlockstudioVendor\League\CommonMark\Normalizer\TextNormalizerInterface;
use BlockstudioVendor\League\CommonMark\Parser\Block\BlockStartParserInterface;
use BlockstudioVendor\League\CommonMark\Parser\Inline\InlineParserInterface;
use BlockstudioVendor\League\CommonMark\Renderer\NodeRendererInterface;
use BlockstudioVendor\League\Config\ConfigurationProviderInterface;
use BlockstudioVendor\Psr\EventDispatcher\EventDispatcherInterface;
interface EnvironmentInterface extends ConfigurationProviderInterface, EventDispatcherInterface
{
    /**
     * Get all registered extensions
     *
     * @return ExtensionInterface[]
     */
    public function getExtensions(): iterable;
    /**
     * @return iterable<BlockStartParserInterface>
     */
    public function getBlockStartParsers(): iterable;
    /**
     * @return iterable<InlineParserInterface>
     */
    public function getInlineParsers(): iterable;
    public function getDelimiterProcessors(): DelimiterProcessorCollection;
    /**
     * @psalm-param class-string<Node> $nodeClass
     *
     * @return iterable<NodeRendererInterface>
     */
    public function getRenderersForClass(string $nodeClass): iterable;
    public function getSlugNormalizer(): TextNormalizerInterface;
}
