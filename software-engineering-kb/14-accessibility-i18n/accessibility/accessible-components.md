# Accessible Component Patterns

| Property       | Value                                                                |
|---------------|----------------------------------------------------------------------|
| Domain        | Accessibility > Components                                           |
| Importance    | Critical                                                             |
| Audience      | Frontend engineers, design system teams                              |
| Cross-ref     | [05-frontend accessibility](../../05-frontend/web/component-design/accessibility.md) (covers ARIA basics, keyboard fundamentals, focus management, form a11y, live regions) |

---

## Combobox / Autocomplete

Combine a text input with a filterable listbox. Follow the ARIA 1.2 combobox pattern.

```tsx
import { useState, useRef, useId, KeyboardEvent } from "react";

interface ComboboxProps {
  label: string;
  options: string[];
  onSelect: (value: string) => void;
}

export function Combobox({ label, options, onSelect }: ComboboxProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(query.toLowerCase())
  );

  const activeDescendant =
    activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;

  function handleKeyDown(e: KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setIsOpen(true);
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        if (activeIndex >= 0 && filtered[activeIndex]) {
          selectOption(filtered[activeIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setActiveIndex(-1);
        inputRef.current?.focus();
        break;
    }
  }

  function selectOption(value: string) {
    setQuery(value);
    setIsOpen(false);
    setActiveIndex(-1);
    onSelect(value);
  }

  return (
    <div>
      <label htmlFor={`${listboxId}-input`}>{label}</label>
      <input
        id={`${listboxId}-input`}
        ref={inputRef}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeDescendant}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
      />
      {isOpen && filtered.length > 0 && (
        <ul id={listboxId} role="listbox" aria-label={label}>
          {filtered.map((option, i) => (
            <li
              key={option}
              id={`${listboxId}-option-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={() => selectOption(option)}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
      {/* Announce result count to screen readers */}
      <div aria-live="polite" className="sr-only">
        {isOpen ? `${filtered.length} results available` : ""}
      </div>
    </div>
  );
}
```

**Keyboard spec**: ArrowDown/Up to navigate, Enter to select, Escape to close, typing filters.

---

## Data Grid / Table

Use `role="grid"` for interactive tables with cell-level navigation. Use native `<table>` with sorting for read-only data.

```tsx
function DataGrid({ columns, rows, onSort }: DataGridProps) {
  const [focusCell, setFocusCell] = useState({ row: 0, col: 0 });

  function handleKeyDown(e: React.KeyboardEvent, row: number, col: number) {
    const handlers: Record<string, () => void> = {
      ArrowRight: () => setFocusCell({ row, col: Math.min(col + 1, columns.length - 1) }),
      ArrowLeft:  () => setFocusCell({ row, col: Math.max(col - 1, 0) }),
      ArrowDown:  () => setFocusCell({ row: Math.min(row + 1, rows.length), col }),
      ArrowUp:    () => setFocusCell({ row: Math.max(row - 1, 0), col }),
      Home:       () => setFocusCell({ row, col: 0 }),
      End:        () => setFocusCell({ row, col: columns.length - 1 }),
    };
    if (handlers[e.key]) { e.preventDefault(); handlers[e.key](); }
  }

  return (
    <table role="grid" aria-label="User data">
      <thead>
        <tr role="row">
          {columns.map((col, ci) => (
            <th
              key={col.key}
              role="columnheader"
              aria-sort={col.sorted ?? "none"}
              tabIndex={focusCell.row === 0 && focusCell.col === ci ? 0 : -1}
              onKeyDown={(e) => handleKeyDown(e, 0, ci)}
              onClick={() => onSort(col.key)}
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={row.id} role="row">
            {columns.map((col, ci) => (
              <td
                key={col.key}
                role="gridcell"
                tabIndex={focusCell.row === ri + 1 && focusCell.col === ci ? 0 : -1}
                onKeyDown={(e) => handleKeyDown(e, ri + 1, ci)}
              >
                {row[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

**Keyboard spec**: Arrow keys for cell navigation, Home/End for row start/end, Enter to activate sortable headers, `aria-sort="ascending"|"descending"|"none"` on sortable column headers.

---

## Tree View

```tsx
interface TreeNode { id: string; label: string; children?: TreeNode[]; }

function TreeItem({ node, level }: { node: TreeNode; level: number }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = node.children && node.children.length > 0;

  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowRight":
        if (hasChildren && !expanded) setExpanded(true);
        break;
      case "ArrowLeft":
        if (hasChildren && expanded) setExpanded(false);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (hasChildren) setExpanded(!expanded);
        break;
    }
  }

  return (
    <li role="treeitem" aria-expanded={hasChildren ? expanded : undefined}
        aria-level={level} tabIndex={-1} onKeyDown={handleKeyDown}>
      <span>{node.label}</span>
      {hasChildren && expanded && (
        <ul role="group">
          {node.children!.map((child) => (
            <TreeItem key={child.id} node={child} level={level + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

function TreeView({ data, label }: { data: TreeNode[]; label: string }) {
  return (
    <ul role="tree" aria-label={label}>
      {data.map((node) => <TreeItem key={node.id} node={node} level={1} />)}
    </ul>
  );
}
```

**Keyboard spec**: ArrowDown/Up move between visible items, ArrowRight expands or moves to first child, ArrowLeft collapses or moves to parent, Home/End move to first/last visible item.

---

## Menu Button

```tsx
function MenuButton({ label, items }: { label: string; items: MenuItem[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  function handleButtonKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsOpen(true);
      setActiveIndex(0);
    }
  }

  function handleMenuKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % items.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + items.length) % items.length);
        break;
      case "Escape":
        setIsOpen(false);
        buttonRef.current?.focus();
        break;
      case "Enter":
        items[activeIndex]?.action();
        setIsOpen(false);
        buttonRef.current?.focus();
        break;
      default:
        // Typeahead: jump to item starting with typed character
        const match = items.findIndex((item) =>
          item.label.toLowerCase().startsWith(e.key.toLowerCase())
        );
        if (match >= 0) setActiveIndex(match);
    }
  }

  return (
    <div>
      <button ref={buttonRef} aria-haspopup="true" aria-expanded={isOpen}
              aria-controls={menuId} onKeyDown={handleButtonKeyDown}
              onClick={() => setIsOpen(!isOpen)}>
        {label}
      </button>
      {isOpen && (
        <ul id={menuId} role="menu" onKeyDown={handleMenuKeyDown}>
          {items.map((item, i) => (
            <li key={item.id} role="menuitem"
                tabIndex={i === activeIndex ? 0 : -1}
                ref={(el) => { if (i === activeIndex) el?.focus(); }}>
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

**Keyboard spec**: Enter/Space/ArrowDown opens menu, ArrowDown/Up navigates, Enter activates, Escape closes and returns focus, character keys trigger typeahead.

---

## Disclosure / Accordion

```tsx
function Accordion({ items }: { items: { id: string; title: string; content: React.ReactNode }[] }) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div>
      {items.map((item) => {
        const isExpanded = expandedIds.has(item.id);
        const panelId = `panel-${item.id}`;
        const headerId = `header-${item.id}`;
        return (
          <div key={item.id}>
            <h3>
              <button id={headerId} aria-expanded={isExpanded}
                      aria-controls={panelId} onClick={() => toggle(item.id)}>
                {item.title}
              </button>
            </h3>
            <div id={panelId} role="region" aria-labelledby={headerId}
                 hidden={!isExpanded}>
              {item.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

---

## Carousel / Slider

```tsx
function Carousel({ slides, label }: { slides: Slide[]; label: string }) {
  const [current, setCurrent] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <section aria-roledescription="carousel" aria-label={label}>
      <div aria-live={isPlaying ? "off" : "polite"} aria-atomic="true">
        <div role="group" aria-roledescription="slide"
             aria-label={`Slide ${current + 1} of ${slides.length}`}>
          {slides[current].content}
        </div>
      </div>
      <button aria-label={isPlaying ? "Pause carousel" : "Play carousel"}
              onClick={() => setIsPlaying(!isPlaying)}>
        {isPlaying ? "Pause" : "Play"}
      </button>
      <button aria-label="Previous slide" onClick={() => setCurrent((c) => (c - 1 + slides.length) % slides.length)}>
        Previous
      </button>
      <button aria-label="Next slide" onClick={() => setCurrent((c) => (c + 1) % slides.length)}>
        Next
      </button>
      {/* Dot navigation */}
      <div role="tablist" aria-label="Slide selection">
        {slides.map((_, i) => (
          <button key={i} role="tab" aria-selected={i === current}
                  aria-label={`Go to slide ${i + 1}`}
                  onClick={() => setCurrent(i)} />
        ))}
      </div>
    </section>
  );
}
```

Set `aria-live="off"` during auto-play to avoid overwhelming screen reader users.

---

## Drag and Drop — Accessible Alternatives

Never rely solely on mouse drag. Provide keyboard-operable alternatives.

```tsx
function ReorderableList({ items, onReorder }: ReorderableListProps) {
  const [liveMessage, setLiveMessage] = useState("");

  function moveItem(index: number, direction: "up" | "down") {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= items.length) return;
    const updated = [...items];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    onReorder(updated);
    setLiveMessage(
      `${items[index].label} moved ${direction} to position ${newIndex + 1} of ${items.length}`
    );
  }

  return (
    <>
      <ul aria-label="Reorderable items">
        {items.map((item, i) => (
          <li key={item.id}>
            <span>{item.label}</span>
            <button aria-label={`Move ${item.label} up`}
                    disabled={i === 0} onClick={() => moveItem(i, "up")}>
              Move up
            </button>
            <button aria-label={`Move ${item.label} down`}
                    disabled={i === items.length - 1} onClick={() => moveItem(i, "down")}>
              Move down
            </button>
          </li>
        ))}
      </ul>
      <div aria-live="assertive" className="sr-only">{liveMessage}</div>
    </>
  );
}
```

---

## Best Practices

1. **Use `aria-activedescendant` for composite widgets** (combobox, grid) instead of moving DOM focus, to keep the input focused while visually highlighting options.
2. **Return focus to the trigger element** when closing menus, dialogs, and popovers to prevent focus from resetting to the document body.
3. **Announce dynamic changes** with `aria-live` regions — use `polite` for non-urgent updates and `assertive` only for critical alerts.
4. **Implement full keyboard interaction specs** from the WAI-ARIA Authoring Practices Guide for every custom widget.
5. **Use `aria-roledescription` sparingly** — only to clarify unfamiliar widget types (e.g., "carousel", "slide") and never to override standard roles.
6. **Provide accessible alternatives to drag-and-drop** — move up/down buttons, select-and-move, or keyboard shortcuts for reordering.
7. **Use `aria-sort` on sortable table headers** and update it dynamically when the user changes the sort direction.
8. **Test every custom widget with at least two screen readers** (NVDA + VoiceOver minimum) to verify announcement correctness.
9. **Implement typeahead search** in menu and listbox widgets — pressing a character key should jump to the matching item.
10. **Set `tabIndex={-1}` on non-active items** in composite widgets and manage focus with roving tabindex or `aria-activedescendant`.

---

## Anti-Patterns

| # | Anti-Pattern | Problem | Correct Approach |
|---|-------------|---------|------------------|
| 1 | Using `role="listbox"` without keyboard support | Screen reader announces a listbox but arrow keys do not work | Implement full keyboard spec: ArrowDown/Up, Home/End, typeahead |
| 2 | Mouse-only drag and drop | Keyboard and screen reader users cannot reorder items | Provide Move Up/Down buttons or keyboard shortcuts as alternatives |
| 3 | Opening menus on hover only | Keyboard users cannot access menu; touch users have no hover | Use click/Enter to open; hover can supplement but not replace |
| 4 | Focus not returned after dialog close | Focus moves to top of page; user loses context | Track trigger element and call `trigger.focus()` on close |
| 5 | Carousel auto-plays without pause control | Screen reader users hear constant content changes; vestibular issues | Always provide a Pause button; set `aria-live="off"` during auto-play |
| 6 | Using `aria-grabbed` / `aria-dropeffect` (deprecated) | These ARIA attributes were deprecated in ARIA 1.1 | Use live region announcements with move up/down button alternatives |
| 7 | Grid without cell-level navigation | Users cannot navigate to individual cells with arrow keys | Implement roving tabindex on cells with Arrow, Home, End key handling |
| 8 | Combobox without result count announcement | Screen reader users do not know how many options are available | Add `aria-live="polite"` region announcing filtered result count |

---

## Enforcement Checklist

- [ ] Every custom widget implements the full keyboard interaction spec from WAI-ARIA APG
- [ ] `aria-activedescendant` or roving tabindex used consistently in composite widgets
- [ ] Focus returns to trigger element when menus, dialogs, and popovers close
- [ ] Drag-and-drop interactions have keyboard-operable alternatives
- [ ] Carousels have pause/play control and `aria-live` set to `"off"` during auto-play
- [ ] Combobox announces result count via `aria-live` region
- [ ] Data grids support Arrow, Home, End key cell navigation and `aria-sort` on sortable headers
- [ ] Tree views support ArrowRight/Left to expand/collapse and ArrowUp/Down to traverse
- [ ] All custom widgets tested with NVDA + Firefox and VoiceOver + Safari
- [ ] No deprecated ARIA attributes (`aria-grabbed`, `aria-dropeffect`) used in codebase
