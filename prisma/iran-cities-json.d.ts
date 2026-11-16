declare module 'iran-cities-json' {
  export interface IranOstan {
    id: number;
    name: string;
  }

  export interface IranShahr {
    id: number;
    name: string;
    ostan: number;
  }

  export const ostan: IranOstan[];
  export const shahr: IranShahr[];
}
