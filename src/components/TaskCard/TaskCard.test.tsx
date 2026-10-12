import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Tarefa } from '../../types/Tarefa';
import { TaskCard } from './TaskCard';

const tarefa: Tarefa = { _id: '123', titulo: 'Revisar interface', descricao: 'Conferir no celular', data: '2026-11-09', prioridade: 'high', projeto: 'TaskFlow', concluida: false };

describe('TaskCard', () => {
  it('apresenta todos os dados e mantém o dia do prazo sem conversão de fuso', () => {
    render(<TaskCard tarefa={tarefa} aoExcluir={vi.fn()} aoEditar={vi.fn()} />);
    expect(screen.getByRole('heading', { name: tarefa.titulo })).toBeInTheDocument();
    expect(screen.getByText(tarefa.descricao)).toBeInTheDocument();
    expect(screen.getByText('09/11/2026')).toHaveAttribute('datetime', '2026-11-09');
    expect(screen.getByText('TaskFlow')).toBeInTheDocument();
    expect(screen.getByText('Prioridade Alta')).toBeInTheDocument();
    expect(screen.getByText('Pendente')).toBeInTheDocument();
  });

  it('representa conclusão e campos opcionais vazios sem oferecer alteração de conclusão', () => {
    render(<TaskCard tarefa={{ ...tarefa, data: '', descricao: '', projeto: '', concluida: true }} aoExcluir={vi.fn()} aoEditar={vi.fn()} />);
    expect(screen.getByText('Sem prazo')).toBeInTheDocument();
    expect(screen.getByText('Sem projeto')).toBeInTheDocument();
    expect(screen.getByText('Sem descrição.')).toBeInTheDocument();
    expect(screen.getByText('Concluída')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('aguarda a exclusão, bloqueia cliques repetidos e depende da coleção para remover o card', async () => {
    let concluir!: () => void;
    const aoExcluir = vi.fn(() => new Promise<void>((resolve) => { concluir = resolve; }));
    render(<TaskCard tarefa={tarefa} aoExcluir={aoExcluir} aoEditar={vi.fn()} />);
    const botao = screen.getByRole('button', { name: `Excluir tarefa: ${tarefa.titulo}` });
    fireEvent.click(botao);
    fireEvent.click(botao);
    expect(botao).toBeDisabled();
    expect(botao).toHaveTextContent('Excluindo...');
    expect(aoExcluir).toHaveBeenCalledExactlyOnceWith('123');
    await act(async () => { concluir(); });
    expect(botao).toBeEnabled();
    expect(screen.getByRole('heading', { name: tarefa.titulo })).toBeInTheDocument();
  });

  it('não solicita exclusão quando a tarefa não tem identificador', () => {
    const aoExcluir = vi.fn();
    render(<TaskCard tarefa={{ ...tarefa, _id: undefined }} aoExcluir={aoExcluir} aoEditar={vi.fn()} />);
    const botao = screen.getByRole('button', { name: `Excluir tarefa: ${tarefa.titulo}` });
    expect(botao).toBeDisabled();
    fireEvent.click(botao);
    expect(aoExcluir).not.toHaveBeenCalled();
  });
});
