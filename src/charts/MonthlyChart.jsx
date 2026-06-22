import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { useFmt } from "../format.js";

export default function MonthlyChart({ data }) {
  const fmt = useFmt();
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#29323f" />
        <XAxis dataKey="month" stroke="#8a93a3" fontSize={11} />
        <YAxis stroke="#8a93a3" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
        <Tooltip contentStyle={{ background: "#1c2433", border: "1px solid #29323f", borderRadius: 8 }} formatter={(v) => fmt(v)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="income" name="Ingresos" fill="#2ecc71" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expense" name="Gastos" fill="#e25c5c" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
