import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactElement,
  type ReactNode,
  type SetStateAction,
} from "react";

import type {
  CustomPractice,
  TemplatePractice,
} from "../../goals/components/GoalTemplateList";
import { createDefaultGoalTemplates } from "../../goals/components/GoalTemplateList";
import type { CycleDurationDays } from "../domain/types";

export type EditorTarget =
  | { kind: "create" }
  | { kind: "edit-template"; id: string }
  | { kind: "edit-custom"; id: string };

export type CycleSetupContextValue = {
  durationDays: CycleDurationDays;
  selectDuration: (next: CycleDurationDays) => void;
  templates: TemplatePractice[];
  setTemplates: Dispatch<SetStateAction<TemplatePractice[]>>;
  customPractices: CustomPractice[];
  setCustomPractices: Dispatch<SetStateAction<CustomPractice[]>>;
  nextCustomId: number;
  setNextCustomId: Dispatch<SetStateAction<number>>;
  cycleName: string;
  setCycleName: (name: string) => void;
  includedPractices: (TemplatePractice | CustomPractice)[];
  hasPractices: boolean;
};

function defaultCycleName(durationDays: CycleDurationDays): string {
  return `${durationDays}-Day Cycle`;
}

const CycleSetupContext = createContext<CycleSetupContextValue | null>(null);

export function CycleSetupProvider({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  const [durationDays, setDurationDays] = useState<CycleDurationDays>(30);
  const [templates, setTemplates] =
    useState<TemplatePractice[]>(createDefaultGoalTemplates);
  const [customPractices, setCustomPractices] = useState<CustomPractice[]>([]);
  const [cycleName, setCycleNameState] = useState(defaultCycleName(30));
  const [nameTouched, setNameTouched] = useState(false);
  const [nextCustomId, setNextCustomId] = useState(1);

  const includedPractices = useMemo(
    () => [
      ...templates.filter((template) => template.selected),
      ...customPractices,
    ],
    [templates, customPractices],
  );

  const hasPractices = includedPractices.length > 0;

  function selectDuration(next: CycleDurationDays) {
    setDurationDays(next);
    if (!nameTouched) {
      setCycleNameState(defaultCycleName(next));
    }
  }

  function setCycleName(name: string) {
    setNameTouched(true);
    setCycleNameState(name);
  }

  const value: CycleSetupContextValue = {
    durationDays,
    selectDuration,
    templates,
    setTemplates,
    customPractices,
    setCustomPractices,
    nextCustomId,
    setNextCustomId,
    cycleName,
    setCycleName,
    includedPractices,
    hasPractices,
  };

  return (
    <CycleSetupContext.Provider value={value}>
      {children}
    </CycleSetupContext.Provider>
  );
}

export function useCycleSetupState(): CycleSetupContextValue {
  const value = useContext(CycleSetupContext);
  if (value == null) {
    throw new Error("useCycleSetupState must be used within CycleSetupProvider");
  }
  return value;
}
