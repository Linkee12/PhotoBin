import { AlbumItem } from "./AlbumItem";
import Check2 from "@assets/images/icons/check2.svg?react";
import Check from "@assets/images/icons/check.svg?react";
import { styled } from "../../../stitches.config";
import { Panel, PanelHeader, PushDown } from "./Panel";
import { ThumbnailGroup } from "../Album";
import { KeyboardEvent, useEffect, useRef, useState } from "react";

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

  return (
    <Panel zIndex={0} variant={props.index % 2 == 0 ? 1 : 2}>
      <PanelHeader>
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
          {props.group.meta && <Meta data-group-meta>· {props.group.meta}</Meta>}
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
      </PanelHeader>
      {!props.isCollapsed && (
        <Images>
          {props.group.thumbnails.map((image) => (
            <AlbumItem
              key={image.id}
              isVideo={image.isVideo}
              imageSrc={image.thumbnail}
              fileName={image.name}
              isSelected={props.isSelected(image.id)}
              isSelectionMode={props.selectedImages.length > 0}
              isNew={props.newFileIds.includes(image.id)}
              scrollIntoView={props.newFileIds[0] === image.id}
              onSelect={() => props.onSelect([image.id])}
              onDeselect={() => props.onDeSelect([image.id])}
              onOpen={() => props.onOpen(image.id)}
            />
          ))}
        </Images>
      )}
      <PushDown />
    </Panel>
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

const Header = styled("div", {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  height: "3rem",
  color: "#fff",
  fontFamily: "SourceCodeVF",
  whiteSpace: "nowrap",
  cursor: "pointer",
  userSelect: "none",
  "@narrow": {
    paddingLeft: "1.28rem",
    fontSize: "1.1rem",
  },
  "@wide": {
    paddingLeft: "5rem",
    fontSize: "1.42rem",
  },
});

const Chevron = styled("span", {
  display: "inline-block",
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
  width: "12ch",
  minWidth: "6ch",
  "&:focus": { outline: "none" },
});

const Meta = styled("span", {
  color: "#9A9A9A",
  fontSize: "0.7em",
});

const SelectAll = styled("div", {
  cursor: "pointer",
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
