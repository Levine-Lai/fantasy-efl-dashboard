"use client";

import { Children, isValidElement, useId, type ReactNode } from "react";
import { Select } from "radix-ui";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

type OptionProps = { value: string | number; children: ReactNode; disabled?: boolean; "data-group"?: string; title?: string };
type Props = { value: string | number; onValueChange: (value: string) => void; children: ReactNode; "aria-label"?: string };

export function FilterSelect({ value, onValueChange, children, "aria-label": label }: Props) {
  const id = useId();
  const options = Children.toArray(children).filter(isValidElement<OptionProps>);
  const groups = [...new Set(options.map(option => option.props["data-group"] ?? ""))];
  return <Select.Root value={String(value)} onValueChange={onValueChange}>
    <Select.Trigger id={id} aria-label={label} className="filter-select-trigger"><Select.Value /><Select.Icon><ChevronDown size={15} /></Select.Icon></Select.Trigger>
    <Select.Portal><Select.Content className="filter-select-menu" position="popper" sideOffset={6} collisionPadding={12}>
      <Select.ScrollUpButton className="filter-select-scroll"><ChevronUp size={14} /></Select.ScrollUpButton>
      <Select.Viewport className="filter-select-viewport">{groups.map(group => <Select.Group key={group}>
        {group && <Select.Label className="filter-select-group">{group}</Select.Label>}
        {options.filter(option => (option.props["data-group"] ?? "") === group).map(option => <Select.Item className="filter-select-option" value={String(option.props.value)} key={String(option.props.value)} disabled={option.props.disabled} title={option.props.title}>
          <Select.ItemText>{option.props.children}</Select.ItemText><Select.ItemIndicator className="filter-select-check"><Check size={14} /></Select.ItemIndicator>
        </Select.Item>)}
      </Select.Group>)}</Select.Viewport>
      <Select.ScrollDownButton className="filter-select-scroll"><ChevronDown size={14} /></Select.ScrollDownButton>
    </Select.Content></Select.Portal>
  </Select.Root>;
}
