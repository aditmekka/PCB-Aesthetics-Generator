export type CornerStyle = 'round';
export type Arrangement = 'row' | 'column';
export type Background = 'transparent' | 'white';
export type Capture = 'strip' | 'single';
export type ExportStyle = 'knockout' | 'colorized';
export type HAlign = 'left' | 'center' | 'right';
export type VAlign = 'top' | 'middle' | 'bottom';
/** JLCPCB character process selected when ordering the board. */
export type JlcProfile = 'standard' | 'highPrecision';

export interface TextStyle {
  /** Cap height in mm (the height of an uppercase letter). */
  height: number;
  /** Glyph width in mm (KiCad text size width). */
  width: number;
  /** Minimum stroke thickness in mm (KiCad text thickness). */
  thickness: number;
  /** Extra space between characters in mm (helps meet the 0.15 mm gap rule). */
  letterSpacing: number;
  /** CSS font family. */
  font: string;
  /** CSS font weight. */
  weight: number;
  /** Horizontal justification in the box. */
  hAlign: HAlign;
  /** Vertical justification in the box. */
  vAlign: VAlign;
}

export interface BoxStyle {
  /** Horizontal padding in mm between text and box edge. */
  padX: number;
  /** Vertical padding in mm between text and box edge. */
  padY: number;
  /** Corner radius in mm. */
  cornerRadius: number;
}

export interface LabelConfig {
  id: string;
  text: string;
  enabled: boolean;
  /** Draw an individual rounded box behind this label's text. */
  showBox: boolean;
  /** Optional per-label text style override. */
  style?: Partial<TextStyle>;
}

export interface LayoutStyle {
  /** Center-to-center distance between adjacent labels in mm (e.g. 2.54). */
  pitch: number;
  /** Rotation of each label in degrees: 0 | 90 | 180 | 270. */
  orientation: number;
  /** Direction the strip of labels extends. */
  arrangement: Arrangement;
  /** Origin X of the strip in mm. */
  originX: number;
  /** Origin Y of the strip in mm. */
  originY: number;
}

export interface PreviewStyle {
  boxColor: string;
  boxAlpha: number;
  boardColor: string;
  boardAlpha: number;
  textColor: string;
  textAlpha: number;
  showPreviewBg: boolean;
}

export interface PlateStyle {
  /** Draw a single large rounded box that contains all the labels. */
  showPlate: boolean;
  /** Hide every per-label box so only the single plate is drawn. */
  disableBoxes: boolean;
  /** Plate width in mm; 0 = auto-fit to the content. */
  widthMm: number;
  /** Plate height in mm; 0 = auto-fit to the content. */
  heightMm: number;
  /** Gap between the labels and the plate edge when auto-fitting. */
  marginMm: number;
  /** Corner radius in mm for the plate corners. */
  cornerRadiusMm: number;
  /** Which of the four plate corners are rounded. */
  roundTL: boolean;
  roundTR: boolean;
  roundBL: boolean;
  roundBR: boolean;
}

export interface SpecConfig {
  /** Which JLCPCB character process the design is checked against. */
  profile: JlcProfile;
  /** Ask for confirmation before exporting a design that exceeds a hard limit. */
  guardExport: boolean;
}

export interface ExportConfig {
  /** DPI used for the exported PNG; maps pixels to mm in KiCad's converter. */
  dpi: number;
  /** Margin around the content in mm. */
  margin: number;
  /** Background of the exported bitmap (applies to the knockout export). */
  background: Background;
  /** Export the whole strip or a single label. */
  capture: Capture;
  /** Index of the label to export when capture === 'single'. */
  singleIndex: number;
  /** 'knockout' = black-on-transparent for KiCad; 'colorized' = full RGBA image. */
  style: ExportStyle;
}

export interface Config {
  text: TextStyle;
  box: BoxStyle;
  layout: LayoutStyle;
  plate: PlateStyle;
  preview: PreviewStyle;
  export: ExportConfig;
  spec: SpecConfig;
  labels: LabelConfig[];
}
