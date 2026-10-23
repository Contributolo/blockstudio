import { store, getContext, getElement } from '@wordpress/interactivity';

interface Context {
  columnId: string;
  sortColumn: string;
  sortDirection: string;
  sortable: boolean;
}

store('bsui/table', {
  state: {
    get sortIcon() {
      const { sortColumn, sortDirection, columnId } = getContext<Context>();
      if (sortColumn !== columnId) return '';
      return sortDirection === 'asc' ? '\u2191' : '\u2193';
    },
    get isSorted() {
      const { sortColumn, columnId } = getContext<Context>();
      return sortColumn === columnId;
    },
    get ariaSort() {
      const { sortColumn, sortDirection, columnId } = getContext<Context>();
      if (sortColumn !== columnId) return 'none';
      return sortDirection === 'asc' ? 'ascending' : 'descending';
    },
  },
  actions: {
    sort() {
      const ctx = getContext<Context>();
      if (!ctx.sortable) return;

      const { ref } = getElement() as { ref: HTMLElement };
      const columnId = ctx.columnId;

      if (ctx.sortColumn === columnId) {
        ctx.sortDirection = ctx.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        ctx.sortColumn = columnId;
        ctx.sortDirection = 'asc';
      }

      const root = ref.closest<HTMLElement>('[data-bsui-table-root]');
      const table = root?.querySelector<HTMLElement>('table');
      if (!table) return;

      const tbody = table.querySelector<HTMLElement>('tbody');
      if (!tbody) return;

      const headers = [
        ...table.querySelectorAll<HTMLElement>('th[data-column-id]'),
      ];
      const colIndex = headers.findIndex(
        (h) => h.getAttribute('data-column-id') === columnId,
      );
      if (colIndex === -1) return;

      const rows = [...tbody.querySelectorAll<HTMLElement>('tr')];
      const dir = ctx.sortDirection === 'asc' ? 1 : -1;

      rows.sort((a, b) => {
        const aCell = a.children[colIndex];
        const bCell = b.children[colIndex];
        const aVal = aCell?.textContent?.trim() || '';
        const bVal = bCell?.textContent?.trim() || '';

        const aNum = parseFloat(aVal);
        const bNum = parseFloat(bVal);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return (aNum - bNum) * dir;
        }
        return aVal.localeCompare(bVal) * dir;
      });

      rows.forEach((row) => tbody.appendChild(row));
    },
  },
});
