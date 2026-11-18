import React from 'react';
import type { PaletteInterface } from '../palette';
import { ModularAppPalette } from '../palette/providers/modular-app';
import type { Repository, Storage } from '../storage';

export type AppContextValue = {
  palette: PaletteInterface;
  storage?: Storage;
  repository?: Repository;
};

export const AppContext = React.createContext<AppContextValue>({ palette: ModularAppPalette });
