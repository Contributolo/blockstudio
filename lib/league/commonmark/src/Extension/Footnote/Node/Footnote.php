<?php

/*
 * This file is part of the league/commonmark package.
 *
 * (c) Colin O'Dell <colinodell@gmail.com>
 * (c) Rezo Zero / Ambroise Maupate
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
declare (strict_types=1);
namespace BlockstudioVendor\League\CommonMark\Extension\Footnote\Node;

use BlockstudioVendor\League\CommonMark\Node\Block\AbstractBlock;
use BlockstudioVendor\League\CommonMark\Reference\ReferenceInterface;
use BlockstudioVendor\League\CommonMark\Reference\ReferenceableInterface;
final class Footnote extends AbstractBlock implements ReferenceableInterface
{
    /** @psalm-readonly */
    private ReferenceInterface $reference;
    public function __construct(ReferenceInterface $reference)
    {
        parent::__construct();
        $this->reference = $reference;
    }
    public function getReference(): ReferenceInterface
    {
        return $this->reference;
    }
}
