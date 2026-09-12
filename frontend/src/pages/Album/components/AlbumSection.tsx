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
  /** Where the toolbar shares its row with this (first) group's header: render the header there. */
  headerSlot?: HTMLElement | null;
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
      headerSlot={props.headerSlot}
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
          <GroupName name={props.group.title} onRename={props.onRename} />
          {props.group.meta && <Meta data-group-meta>{props.group.meta}</Meta>}
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
 * Chevron, select-all, name, and the meta on a second line. The header is
 * always in the water of its wave, whose curve descends left to right, so it
 * keeps to the left and the name wraps rather than running under the curve.
 * With the wide toolbar the wave is as tall as the band and the header takes
 * its left third, starting deep enough below the top; with the bottom sheet
 * the curve spans only `WAVE_HEIGHT`, so the header overlaps that span and the
 * name column ends where the curve is still above the text.
 */
const Header = styled("div", {
  pointerEvents: "auto",
  boxSizing: "border-box",
  width: "100%",
  color: "#fff",
  fontFamily: "SourceCodeVF",
  cursor: "pointer",
  userSelect: "none",
  display: "grid",
  columnGap: "0.5rem",
  rowGap: "0.1rem",
  alignItems: "center",
  overflowWrap: "anywhere",
  "@narrow": {
    paddingLeft: "1.28rem",
    fontSize: "1.1rem",
  },
  "@wide": {
    paddingLeft: "5rem",
    fontSize: "1.42rem",
  },
  "@toolbarInline": {
    gridTemplateColumns: "auto auto minmax(0, 1fr)",
    paddingTop: "2rem",
    paddingRight: "1rem",
    paddingBottom: "1rem",
  },
  "@toolbarStacked": {
    // The name column ends at half the band, where the curve (spanning
    // `WAVE_HEIGHT`) is still well above the text.
    gridTemplateColumns: "auto auto minmax(0, 1fr) 50%",
    paddingTop: "2rem",
    paddingBottom: "0.75rem",
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
  minWidth: 0,
  justifySelf: "start",
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
  minWidth: 0,
  maxWidth: "100%",
  boxSizing: "border-box",
  "&:focus": { outline: "none" },
});

const Meta = styled("span", {
  color: "#9A9A9A",
  fontSize: "0.7em",
  whiteSpace: "nowrap",
  gridColumn: "3 / -1",
  gridRow: 2,
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
