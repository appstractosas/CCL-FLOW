import React from 'react';
import { Cliente, Ciudad } from '../../../types';
import { filtrarEntradaPlaca } from '../../../utils/placa';
import { inputCls, lockedCls } from './estilos';

interface CampoPlacaProps {
  value: string;
  onChange: (valor: string) => void;
}

/** Placa del vehículo: solo acepta ABC123 o A12345 (el guion se descarta al escribir). */
export const CampoPlaca: React.FC<CampoPlacaProps> = ({ value, onChange }) => (
  <div>
    <label className="block text-xs font-bold text-zinc-300 mb-1">Placa Remolque</label>
    <input
      type="text"
      placeholder="Opcional · Ej: TGB-512"
      value={value}
      onChange={(e) => onChange(filtrarEntradaPlaca(e.target.value, value))}
      className={`${inputCls} font-mono uppercase`}
    />
  </div>
);

interface CamposDenominacionTransporteProps {
  denominacion: string;
  transporte: string;
  clientes: Cliente[];
  locked: boolean;
  onDenominacionChange: (valor: string) => void;
  onTransporteChange: (valor: string) => void;
}

/** Fila Denominación (cliente) + Nº de transporte. */
export const CamposDenominacionTransporte: React.FC<CamposDenominacionTransporteProps> = ({
  denominacion,
  transporte,
  clientes,
  locked,
  onDenominacionChange,
  onTransporteChange,
}) => (
  <div className="grid grid-cols-2 gap-3">
    <div>
      <label className="block text-xs font-bold text-zinc-300 mb-1">Denominación</label>
      <select
        value={denominacion}
        disabled={locked}
        onChange={(e) => onDenominacionChange(e.target.value)}
        className={`${locked ? lockedCls : inputCls} ${denominacion ? '' : 'text-zinc-500'}`}
      >
        <option value="">Seleccionar cliente</option>
        {clientes.map((c) => (
          <option key={c.id} value={c.denominacion}>
            {c.denominacion}
          </option>
        ))}
      </select>
    </div>
    <div>
      <label className="block text-xs font-bold text-zinc-300 mb-1">Transporte</label>
      <input
        type="text"
        placeholder="Ej: 3000214899"
        value={transporte}
        disabled={locked}
        onChange={(e) => onTransporteChange(e.target.value)}
        className={`${locked ? lockedCls : inputCls} font-mono`}
      />
    </div>
  </div>
);

interface CamposCajaDestinoRegionProps {
  cajas: string;
  destino: string;
  region: string;
  ciudades: Ciudad[];
  locked: boolean;
  cajasEditable: boolean;
  onCajasChange: (valor: string) => void;
  /** Devuelve el destino elegido y la región sugerida (undefined si la ciudad no la define). */
  onDestinoChange: (destino: string, regionSugerida?: string) => void;
}

/** Cajas (según estado) + Destino y Región (región derivada del catálogo de ciudades). */
export const CamposCajaDestinoRegion: React.FC<CamposCajaDestinoRegionProps> = ({
  cajas,
  destino,
  region,
  ciudades,
  locked,
  cajasEditable,
  onCajasChange,
  onDestinoChange,
}) => (
  <>
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-bold text-zinc-300 mb-1">Cajas</label>
        <input
          type="number"
          min={0}
          placeholder="Ej: 579"
          value={cajas}
          disabled={locked || !cajasEditable}
          onChange={(e) => onCajasChange(e.target.value)}
          className={`${locked || !cajasEditable ? lockedCls : inputCls} font-mono text-right`}
        />
      </div>
    </div>

    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-bold text-zinc-300 mb-1">Destino</label>
        <select
          value={destino}
          disabled={locked}
          onChange={(e) => {
            const ciudad = ciudades.find((c) => c.ciudad === e.target.value);
            onDestinoChange(e.target.value, ciudad?.region);
          }}
          className={`${locked ? lockedCls : inputCls} ${destino ? '' : 'text-zinc-500'}`}
        >
          <option value="">Seleccionar destino</option>
          {ciudades.map((c) => (
            <option key={c.id} value={c.ciudad}>
              {c.ciudad}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-bold text-zinc-300 mb-1">Región</label>
        <input type="text" value={region} disabled className={lockedCls} />
      </div>
    </div>
  </>
);
