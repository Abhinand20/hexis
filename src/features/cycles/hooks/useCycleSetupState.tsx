import {
  createContext,
  useCallback,
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
import type { RepeatCycleDraft } from "../domain/repeatCycleDraft";
import type { CycleDurationDays } from "../domain/types";

export type EditorTarget =
  | { kind: "create" }
  | { kind: "edit-template"; id: string }
  | { kind: "edit-custom"; id: string };

export type RepeatSetupSource = {
  cycleId: string;
  cycleName: string;
};

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
  repeatSource: RepeatSetupSource | null;
  initializeFromRepeatDraft: (
    source: RepeatSetupSource,
    draft: RepeatCycleDraft,
  ) => void;
};

function defaultCycleName(durationDays: CycleDurationDays): string {
  return `${durationDays}-Day Cycle`;
}

const CycleSetupContext = createContext<CycleSetupContextValue | null>(null);

type SetupState = {
  durationDays: CycleDurationDays;
  templates: TemplatePractice[];
  customPractices: CustomPractice[];
  cycleName: string;
  nameTouched: boolean;
  nextCustomId: number;
  repeatSource: RepeatSetupSource | null;
};

function createInitialState(): SetupState {
  return {
    durationDays: 30,
    templates: createDefaultGoalTemplates(),
    customPractices: [],
    cycleName: defaultCycleName(30),
    nameTouched: false,
    nextCustomId: 1,
    repeatSource: null,
  };
}

export function CycleSetupProvider({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  const [state, setState] = useState<SetupState>(createInitialState);

  const setTemplates: Dispatch<SetStateAction<TemplatePractice[]>> =
    useCallback((next) => {
      setState((current) => ({
        ...current,
        templates:
          typeof next === "function" ? next(current.templates) : next,
      }));
    }, []);

  const setCustomPractices: Dispatch<SetStateAction<CustomPractice[]>> =
    useCallback((next) => {
      setState((current) => ({
        ...current,
        customPractices:
          typeof next === "function" ? next(current.customPractices) : next,
      }));
    }, []);

  const setNextCustomId: Dispatch<SetStateAction<number>> = useCallback(
    (next) => {
      setState((current) => ({
        ...current,
        nextCustomId:
          typeof next === "function" ? next(current.nextCustomId) : next,
      }));
    },
    [],
  );

  const includedPractices = useMemo(
    () => [
      ...state.templates.filter((template) => template.selected),
      ...state.customPractices,
    ],
    [state.templates, state.customPractices],
  );

  const hasPractices = includedPractices.length > 0;

  const selectDuration = useCallback((next: CycleDurationDays) => {
    setState((current) => ({
      ...current,
      durationDays: next,
      cycleName: current.nameTouched
        ? current.cycleName
        : defaultCycleName(next),
    }));
  }, []);

  const setCycleName = useCallback((name: string) => {
    setState((current) => ({
      ...current,
      cycleName: name,
      nameTouched: true,
    }));
  }, []);

  const initializeFromRepeatDraft = useCallback(
    (source: RepeatSetupSource, draft: RepeatCycleDraft) => {
      setState((current) => {
        if (current.repeatSource?.cycleId === source.cycleId) {
          return current;
        }

        return {
          durationDays: draft.durationDays,
          templates: createDefaultGoalTemplates().map((template) => ({
            ...template,
            selected: false,
          })),
          customPractices: draft.practices.map((practice, index) => ({
            ...practice,
            id: `custom-${index + 1}`,
          })),
          cycleName: draft.cycleName,
          nameTouched: true,
          nextCustomId: draft.practices.length + 1,
          repeatSource: { ...source },
        };
      });
    },
    [],
  );

  const value: CycleSetupContextValue = {
    durationDays: state.durationDays,
    selectDuration,
    templates: state.templates,
    setTemplates,
    customPractices: state.customPractices,
    setCustomPractices,
    nextCustomId: state.nextCustomId,
    setNextCustomId,
    cycleName: state.cycleName,
    setCycleName,
    includedPractices,
    hasPractices,
    repeatSource: state.repeatSource,
    initializeFromRepeatDraft,
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
