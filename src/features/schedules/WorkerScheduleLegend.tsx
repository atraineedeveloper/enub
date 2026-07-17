import styled from "styled-components";

const LegendRow = styled.div`
  display: flex;
  align-items: center;
  gap: 1.6rem;
  margin-bottom: 1.2rem;
  font-size: 1.3rem;
  color: var(--color-grey-600);
`;

const LegendItem = styled.span`
  display: flex;
  align-items: center;
  gap: 0.6rem;
`;

const Swatch = styled.span<{ $color: string }>`
  width: 1.4rem;
  height: 1.4rem;
  border-radius: var(--border-radius-tiny);
  background-color: ${(props) => props.$color};
  flex-shrink: 0;
`;

// Text labels accompany each swatch so meaning never depends on color
// alone (also true at the entry level -- every grid cell/agenda entry
// already carries a "Clase"/"Actividad" text label of its own).
function WorkerScheduleLegend() {
  return (
    <LegendRow aria-hidden="true">
      <LegendItem>
        <Swatch $color="var(--color-gold-200)" />
        Clase
      </LegendItem>
      <LegendItem>
        <Swatch $color="var(--color-gov-green-100)" />
        Actividad
      </LegendItem>
    </LegendRow>
  );
}

export default WorkerScheduleLegend;
