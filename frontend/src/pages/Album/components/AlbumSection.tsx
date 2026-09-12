import { AlbumItem } from "./AlbumItem";
import Check2 from "@assets/images/icons/check2.svg?react";
import Check from "@assets/images/icons/check.svg?react";
import { styled } from "../../../stitches.config";
import { PanelVariant, SectionPanel } from "./Panel";
import { ThumbnailGroup } from "../Album";
import { KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";

type AlbumSectionProps = {
  group: ThumbnailGroup;
  index: number;
  selectedImages: string[];
  isCollapsed: boolean;
  /** ids uploaded in the batch that just finished; their tiles pulse and the first one is scrolled to */
  newFileIds: string[];
  onToggleCollapsed: () => void;
  /** Absent for groups that are not a named upload batch (date groups, "Earlier uploads"). */
  onRename: ((name: string) => void) | undefined;
  isSelected: (imageId: string) => boolean;
  onSelect: (imagesId: string[]) => void;
  onDeSelect: (imagesId: string[]) => void;
  onOpen: (imageId: string) => void;
};

export function AlbumSection(props: AlbumSectionProps) {
  const ids = props.group.thumbnails.map((thumb) => thumb.id);
  const includeAllImages = ids.every((id) => props.selectedImages.includes(id));
  // Stable per-tile callbacks so memoised AlbumItems only re-render when their
  // own thumbnail or selection changes.
  const { onSelect, onDeSelect } = props;
  const selectOne = useCallback((id: string) => onSelect([id]), [onSelect]);
  const deselectOne = useCallback((id: string) => onDeSelect([id]), [onDeSelect]);

  const variant: PanelVariant = props.index % 2 == 0 ? 1 : 2;
  // The band above the wave continues the previous section's colour (the
  // album's own dark ground before the first group).
  let bandVariant: PanelVariant = variant === 1 ? 2 : 1;
  if (props.index === 0) bandVariant = 0;

  return (
    <SectionPanel
      variant={variant}
      bandVariant={bandVariant}
      first={props.index === 0}
      header={
        <Header
          role="button"
          aria-expanded={!props.isCollapsed}
          data-group-header={props.group.key}
          onClick={props.onToggleCollapsed}
        >
          <Chevron collapsed={props.isCollapsed} aria-hidden="true">
            ▾
          </Chevron>
          <GroupName name={props.group.title} onRename={props.onRename} />
          {props.group.meta && <Meta data-group-meta>{props.group.meta}</Meta>}
          <SelectAll
            data-select-group
            title={includeAllImages ? "Unselect group" : "Select group"}
            onClick={(e) => {
              e.stopPropagation();
              if (includeAllImages) props.onDeSelect(ids);
              else props.onSelect(ids);
            }}
          >
            {includeAllImages ? <CheckIcon as={Check} /> : <CheckIcon as={Check2} />}
          </SelectAll>
        </Header>
      }
    >
      {!props.isCollapsed && (
        <Images>
          {props.group.thumbnails.map((image) => (
            <AlbumItem
              key={image.id}
              id={image.id}
              isVideo={image.isVideo}
              imageSrc={image.thumbnail}
              isLoading={image.isLoading}
              fileName={image.name}
              isSelected={props.isSelected(image.id)}
              isSelectionMode={props.selectedImages.length > 0}
              isNew={props.newFileIds.includes(image.id)}
              scrollIntoView={props.newFileIds[0] === image.id}
              onSelect={selectOne}
              onDeselect={deselectOne}
              onOpen={props.onOpen}
            />
          ))}
        </Images>
      )}
    </SectionPanel>
  );
}

/**
 * Click-to-edit group name (same interaction as the album title in Header):
 * Enter or blur saves, Escape restores the previous name.
 */
function GroupName(props: {
  name: string;
  onRename: ((name: string) => void) | undefined;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const editable = props.onRename !== undefined;

  useEffect(() => {
    if (draft !== null) inputRef.current?.select();
  }, [draft !== null]);

  function save() {
    if (draft === null) return;
    const name = draft.trim();
    setDraft(null);
    if (name.length > 0 && name !== props.name) props.onRename?.(name);
  }
  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") save();
    else if (e.key === "Escape") setDraft(null);
  }

  if (draft !== null) {
    return (
      <NameInput
        ref={inputRef}
        value={draft}
        data-group-name-input
        style={{ width: `${Math.max(draft.length, 6)}ch` }}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={save}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }
  return (
    <Name
      editable={editable}
      data-group-name
      title={editable ? "Click to rename" : undefined}
      onClick={(e) => {
        if (!editable) return;
        e.stopPropagation();
        setDraft(props.name);
      }}
    >
      {props.name}
    </Name>
  );
}

/**
 * One row on wide viewports: chevron, name (truncates), meta, checkbox.
 * Two rows on narrow ones: the name gets the whole width and the meta sits
 * under it, so nothing ever runs past the edge of the band.
 */
const Header = styled("div", {
  pointerEvents: "auto",
  boxSizing: "border-box",
  width: "100%",
  color: "#fff",
  fontFamily: "SourceCodeVF",
  whiteSpace: "nowrap",
  cursor: "pointer",
  userSelect: "none",
  "@narrow": {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr) auto",
    columnGap: "0.5rem",
    rowGap: "0.1rem",
    alignItems: "center",
    minHeight: "3rem",
    padding: "0.5rem 1.28rem",
    fontSize: "1.1rem",
  },
  "@wide": {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    minHeight: "3rem",
    padding: "0.5rem 1.9rem 0.5rem 5rem",
    fontSize: "1.42rem",
  },
});

const Chevron = styled("span", {
  display: "inline-block",
  flexShrink: 0,
  fontSize: "1em",
  lineHeight: 1,
  color: "#9A9A9A",
  transition: "transform 200ms",
  "@media (prefers-reduced-motion: reduce)": { transition: "none" },
  variants: {
    collapsed: {
      true: { transform: "rotate(-90deg)" },
      false: { transform: "rotate(0deg)" },
    },
  },
});

const Name = styled("span", {
  flex: "0 1 auto",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  variants: {
    editable: {
      true: {
        cursor: "text",
        borderBottom: "1px dashed transparent",
        "&:hover": { borderBottomColor: "#9A9A9A" },
      },
      false: {},
    },
  },
});

const NameInput = styled("input", {
  font: "inherit",
  color: "inherit",
  background: "none",
  border: "none",
  borderBottom: "1px solid #fff",
  padding: 0,
  flex: "0 1 auto",
  minWidth: 0,
  maxWidth: "100%",
  boxSizing: "border-box",
  "&:focus": { outline: "none" },
});

const Meta = styled("span", {
  flexShrink: 0,
  color: "#9A9A9A",
  fontSize: "0.7em",
  "@narrow": {
    gridColumn: 2,
    gridRow: 2,
  },
  "@wide": {
    "&::before": { content: '"· "' },
  },
});

const SelectAll = styled("div", {
  cursor: "pointer",
  flexShrink: 0,
  width: "1.4rem",
  height: "1.4rem",
  display: "flex",
  alignItems: "center",
});

const Images = styled("div", {
  maxWidth: "100%",
  "@narrow": {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    margin: "1rem 1.28rem 1.28rem 1.28rem",
    gap: "10px",
  },
  "@wide": {
    display: "grid",
    gap: "20px",
    justifyItems: "center",
    // As many columns as fit; each tile is at least 230px and grows up to the
    // 300px cap set on the tile itself (see AlbumItem's Preview).
    gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 230px), 1fr))",
    margin: "1.9rem 1.9rem 1.9rem 1.9rem",
  },
});

const CheckIcon = styled("div", {
  overflow: "visible",
});
