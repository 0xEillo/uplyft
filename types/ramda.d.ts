declare module 'ramda/src/differenceWith' {
  function differenceWith<T>(
    pred: (a: T, b: T) => boolean,
    list1: readonly T[],
    list2: readonly T[]
  ): T[]
  export = differenceWith
}



