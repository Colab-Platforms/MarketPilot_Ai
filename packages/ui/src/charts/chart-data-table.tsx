import type { DataPoint } from './scale';

interface ChartDataTableProps {
  caption: string;
  data: DataPoint[];
  formatValue: (value: number) => string;
}

// The table view of a chart, for screen readers.
export function ChartDataTable({ caption, data, formatValue }: ChartDataTableProps) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Period</th>
          <th scope="col">Value</th>
        </tr>
      </thead>
      <tbody>
        {data.map((d) => (
          <tr key={d.label}>
            <th scope="row">{d.label}</th>
            <td>{formatValue(d.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
