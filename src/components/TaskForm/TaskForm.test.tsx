import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Tarefa } from '../../types/Tarefa';
import { TaskForm } from './TaskForm';

const tarefaExistente: Tarefa = {
  _id: 'abc123',
  titulo: 'Estudar React',
  descricao: 'Revisar hooks e contexto',
  data: '2026-10-13',
  prioridade: 'high',
  projeto: 'TaskFlow',
  concluida: false,
};

describe('TaskForm', () => {
  it('envia os campos da aula sem _id e limpa os valores após sucesso', async () => {
    const salvar = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<TaskForm aoSalvar={salvar} aoCancelar={vi.fn()} />);
    await user.type(screen.getByLabelText(/Título/), '  Revisar atividade  ');
    await user.type(screen.getByLabelText(/Descrição/), 'Conferir requisitos');
    fireEvent.change(screen.getByLabelText(/Prazo/), { target: { value: '2026-11-09' } });
    await user.selectOptions(screen.getByLabelText('Prioridade'), 'high');
    await user.type(screen.getByLabelText(/Projeto/), '  TaskFlow  ');
    await user.click(screen.getByRole('button', { name: 'Criar tarefa' }));
    expect(salvar).toHaveBeenCalledExactlyOnceWith({
      titulo: 'Revisar atividade', descricao: 'Conferir requisitos', data: '2026-11-09',
      prioridade: 'high', projeto: 'TaskFlow', concluida: false,
    });
    expect(screen.getByLabelText(/Título/)).toHaveValue('');
    expect(screen.getByLabelText('Prioridade')).toHaveValue('medium');
  });

  it('permite campos opcionais vazios e usa prioridade média inicialmente', async () => {
    const salvar = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<TaskForm aoSalvar={salvar} aoCancelar={vi.fn()} />);
    await user.type(screen.getByLabelText(/Título/), 'Estudar React');
    await user.click(screen.getByRole('button', { name: 'Criar tarefa' }));
    expect(salvar).toHaveBeenCalledWith({
      titulo: 'Estudar React', descricao: '', data: '', prioridade: 'medium', projeto: '', concluida: false,
    });
  });

  it('não envia título vazio pela validação nativa', async () => {
    const salvar = vi.fn();
    const user = userEvent.setup();
    render(<TaskForm aoSalvar={salvar} aoCancelar={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Criar tarefa' }));
    expect(salvar).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Título/)).toBeInvalid();
  });

  it('rejeita título composto apenas de espaços e mantém o foco no campo', async () => {
    const salvar = vi.fn();
    const user = userEvent.setup();
    render(<TaskForm aoSalvar={salvar} aoCancelar={vi.fn()} />);
    await user.type(screen.getByLabelText(/Título/), '   ');
    await user.click(screen.getByRole('button', { name: 'Criar tarefa' }));
    expect(salvar).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Informe um título');
    expect(screen.getByLabelText(/Título/)).toHaveFocus();
  });

    it('respeita os limites de título e descrição', async () => {
    const user = userEvent.setup();
    render(<TaskForm aoSalvar={vi.fn()} aoCancelar={vi.fn()} />);
    const titulo = screen.getByLabelText(/Título/);
    const descricao = screen.getByLabelText(/Descrição/);
    // O maxLength é imposto pelo próprio input, o que só acontece via digitação real.
    expect(titulo).toHaveAttribute('maxlength', '100');
    expect(descricao).toHaveAttribute('maxlength', '400');
    await user.type(titulo, 'a'.repeat(105));
    await user.type(descricao, 'b'.repeat(405));
    expect(titulo).toHaveValue('a'.repeat(100));
    expect(descricao).toHaveValue('b'.repeat(400));
    expect(screen.getByText('400/400 caracteres')).toBeInTheDocument();
  }, 30000);

  it('bloqueia envio duplicado e cancelamento até a resposta', async () => {
    let concluir!: () => void;
    const salvar = vi.fn(() => new Promise<void>((resolve) => { concluir = resolve; }));
    const cancelar = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<TaskForm aoSalvar={salvar} aoCancelar={cancelar} />);
    await user.type(screen.getByLabelText(/Título/), 'Enviar uma vez');
    const form = container.querySelector('form')!;
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    expect(salvar).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Salvando...' })).toBeDisabled();
    expect(screen.getByLabelText(/Título/)).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(cancelar).not.toHaveBeenCalled();
    await act(async () => { concluir(); });
    expect(screen.getByRole('button', { name: 'Criar tarefa' })).toBeEnabled();
  });

  it('mantém os campos quando salvar falha e permite tentar novamente', async () => {
    const salvar = vi.fn().mockRejectedValueOnce(new Error('Não foi possível criar a tarefa.')).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<TaskForm aoSalvar={salvar} aoCancelar={vi.fn()} />);
    await user.type(screen.getByLabelText(/Título/), 'Preservar preenchimento');
    await user.type(screen.getByLabelText(/Descrição/), 'Observação importante');
    await user.click(screen.getByRole('button', { name: 'Criar tarefa' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível criar');
    expect(screen.getByLabelText(/Título/)).toHaveValue('Preservar preenchimento');
    expect(screen.getByLabelText(/Descrição/)).toHaveValue('Observação importante');
    await user.click(screen.getByRole('button', { name: 'Criar tarefa' }));
    await waitFor(() => expect(salvar).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('apresenta mensagem útil para rejeições sem objeto Error', async () => {
    const user = userEvent.setup();
    render(<TaskForm aoSalvar={vi.fn().mockRejectedValue(undefined)} aoCancelar={vi.fn()} />);
    await user.type(screen.getByLabelText(/Título/), 'Tentar salvar');
    await user.click(screen.getByRole('button', { name: 'Criar tarefa' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Tente novamente');
  });

  it('cancela sem submeter o formulário', async () => {
    const cancelar = vi.fn();
    const salvar = vi.fn();
    const user = userEvent.setup();
    render(<TaskForm aoSalvar={salvar} aoCancelar={cancelar} />);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(cancelar).toHaveBeenCalledOnce();
    expect(salvar).not.toHaveBeenCalled();
  });

  // ---------- Evolução: modo edição (tarefaInicial) ----------

  it('no modo edição troca o título e o botão e preenche os campos com a tarefa existente', () => {
    render(<TaskForm tarefaInicial={tarefaExistente} aoSalvar={vi.fn()} aoCancelar={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Editar tarefa' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Nova tarefa' })).not.toBeInTheDocument();

    expect(screen.getByLabelText(/Título/)).toHaveValue('Estudar React');
    expect(screen.getByLabelText(/Descrição/)).toHaveValue('Revisar hooks e contexto');
    expect(screen.getByLabelText(/Prazo/)).toHaveValue('2026-10-13');
    expect(screen.getByLabelText('Prioridade')).toHaveValue('high');
    expect(screen.getByLabelText(/Projeto/)).toHaveValue('TaskFlow');

    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Criar tarefa' })).not.toBeInTheDocument();
  });

  it('no modo edição envia os valores alterados, sem _id no corpo', async () => {
    const salvar = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<TaskForm tarefaInicial={tarefaExistente} aoSalvar={salvar} aoCancelar={vi.fn()} />);

    await user.clear(screen.getByLabelText(/Título/));
    await user.type(screen.getByLabelText(/Título/), 'Estudar React e TypeScript');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(salvar).toHaveBeenCalledExactlyOnceWith({
      titulo: 'Estudar React e TypeScript',
      descricao: 'Revisar hooks e contexto',
      data: '2026-10-13',
      prioridade: 'high',
      projeto: 'TaskFlow',
      concluida: false,
    });
    // O identificador vive no path do PUT, não no corpo.
    expect(salvar.mock.calls[0][0]).not.toHaveProperty('_id');
  });

  it('no modo edição, falha preserva os campos digitados e permite tentar de novo', async () => {
    const salvar = vi.fn()
      .mockRejectedValueOnce(new Error('Não foi possível confirmar a edição.'))
      .mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<TaskForm tarefaInicial={tarefaExistente} aoSalvar={salvar} aoCancelar={vi.fn()} />);

    await user.clear(screen.getByLabelText(/Título/));
    await user.type(screen.getByLabelText(/Título/), 'Título que não deve ser perdido');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível confirmar a edição');
    expect(screen.getByLabelText(/Título/)).toHaveValue('Título que não deve ser perdido');
    expect(screen.getByLabelText(/Descrição/)).toHaveValue('Revisar hooks e contexto');

    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(salvar).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

    it('no modo edição, validação de título composto apenas de espaços continua valendo', async () => {
    const salvar = vi.fn();
    const user = userEvent.setup();
    render(<TaskForm tarefaInicial={tarefaExistente} aoSalvar={salvar} aoCancelar={vi.fn()} />);

    await user.clear(screen.getByLabelText(/Título/));
    await user.type(screen.getByLabelText(/Título/), '   ');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(salvar).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Informe um título');
    expect(screen.getByLabelText(/Título/)).toHaveFocus();
  }, 15000);

  it('no modo edição bloqueia cancelamento enquanto salva e reabre habilitado após a resposta', async () => {
    let concluir!: () => void;
    const salvar = vi.fn(() => new Promise<void>((resolve) => { concluir = resolve; }));
    const cancelar = vi.fn();
    const user = userEvent.setup();
    render(<TaskForm tarefaInicial={tarefaExistente} aoSalvar={salvar} aoCancelar={cancelar} />);

    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    expect(screen.getByRole('button', { name: 'Salvando...' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(cancelar).not.toHaveBeenCalled();

    await act(async () => { concluir(); });
    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeEnabled();
  });
});