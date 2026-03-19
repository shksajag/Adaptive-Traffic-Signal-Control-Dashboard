import matplotlib.pyplot as plt
import numpy as np
import os

def load_data(filepath):
    """Load data from text file"""
    with open(filepath, 'r') as f:
        return [float(line.strip()) for line in f]

# Load all data from three approaches
print("Loading data...")
print("  - DQN Agent...")
dqn_queue = load_data('models_dqn/model_10/test/plot_queue_data.txt')
mp_waiting = load_data('models_dqn/model_10/test/plot_avg_waiting_time_data.txt')
dqn_reward = load_data('models_dqn/model_10/test/plot_reward_data.txt')

print("  - Fixed-Time Control...")
fixed_queue = load_data('models_fixed/fixed_time_baseline_1000/plot_queue_data.txt')
fixed_waiting = load_data('models_fixed/fixed_time_baseline_1000/plot_avg_waiting_time_data.txt')
fixed_reward = load_data('models_fixed/fixed_time_baseline_1000/plot_reward_data.txt')

print("  - PE-DQN...")
mp_queue = load_data('models_dqnmp/model_10/test/plot_queue_data.txt')
dqn_waiting = load_data('models_dqnmp/model_10/test/plot_avg_waiting_time_data.txt')
mp_reward = load_data('models_dqnmp/model_10/test/plot_reward_data.txt')

# Calculate statistics
print("\nCalculating statistics...")
metrics = {
    'Queue Length': {
        'dqn_avg': np.mean(dqn_queue),
        'fixed_avg': np.mean(fixed_queue),
        'mp_avg': np.mean(mp_queue),
        'dqn_max': np.max(dqn_queue),
        'fixed_max': np.max(fixed_queue),
        'mp_max': np.max(mp_queue),
        'dqn_data': dqn_queue,
        'fixed_data': fixed_queue,
        'mp_data': mp_queue,
        'unit': 'vehicles',
        'lower_is_better': True
    },
    'Avg Waiting Time': {
        'dqn_avg': np.mean(dqn_waiting),
        'fixed_avg': np.mean(fixed_waiting),
        'mp_avg': np.mean(mp_waiting),
        'dqn_max': np.max(dqn_waiting),
        'fixed_max': np.max(fixed_waiting),
        'mp_max': np.max(mp_waiting),
        'dqn_data': dqn_waiting,
        'fixed_data': fixed_waiting,
        'mp_data': mp_waiting,
        'unit': 'seconds',
        'lower_is_better': True
    },
    'Cumulative Reward': {
        'dqn_total': np.sum(dqn_reward),
        'fixed_total': np.sum(fixed_reward),
        'mp_total': np.sum(mp_reward),
        'dqn_avg': np.mean(dqn_reward),
        'fixed_avg': np.mean(fixed_reward),
        'mp_avg': np.mean(mp_reward),
        'dqn_data': dqn_reward,
        'fixed_data': fixed_reward,
        'mp_data': mp_reward,
        'unit': '',
        'lower_is_better': False
    }
}

# Calculate improvements relative to Fixed-Time baseline
for metric_name, data in metrics.items():
    if metric_name == 'Cumulative Reward':
        baseline = data['fixed_total']
        if baseline != 0:
            data['dqn_improvement'] = ((data['dqn_total'] - baseline) / abs(baseline)) * 100
            data['mp_improvement'] = ((data['mp_total'] - baseline) / abs(baseline)) * 100
        else:
            data['dqn_improvement'] = 0
            data['mp_improvement'] = 0
    else:
        baseline = data['fixed_avg']
        if baseline != 0:
            data['dqn_improvement'] = ((baseline - data['dqn_avg']) / baseline) * 100
            data['mp_improvement'] = ((baseline - data['mp_avg']) / baseline) * 100
        else:
            data['dqn_improvement'] = 0
            data['mp_improvement'] = 0

# Print statistics
print("\n" + "="*80)
print("PERFORMANCE COMPARISON: DQN vs Fixed-Time vs PE-DQN")
print("="*80)

for metric_name, data in metrics.items():
    print(f"\n{metric_name}:")
    if metric_name == 'Cumulative Reward':
        print(f"  DQN Total:              {data['dqn_total']:>12,.0f} {data['unit']}")
        print(f"  Fixed-Time Total:       {data['fixed_total']:>12,.0f} {data['unit']}")
        print(f"  PE-DQN Total:  {data['mp_total']:>12,.0f} {data['unit']}")
        print(f"\n  DQN Avg:                {data['dqn_avg']:>12.2f} {data['unit']}")
        print(f"  Fixed-Time Avg:         {data['fixed_avg']:>12.2f} {data['unit']}")
        print(f"  PE-DQN Avg:    {data['mp_avg']:>12.2f} {data['unit']}")
    else:
        print(f"  DQN Avg:                {data['dqn_avg']:>12.2f} {data['unit']}")
        print(f"  Fixed-Time Avg:         {data['fixed_avg']:>12.2f} {data['unit']}")
        print(f"  PE-DQN Avg:    {data['mp_avg']:>12.2f} {data['unit']}")
        print(f"\n  DQN Max:                {data['dqn_max']:>12.2f} {data['unit']}")
        print(f"  Fixed-Time Max:         {data['fixed_max']:>12.2f} {data['unit']}")
        print(f"  PE-DQN Max:    {data['mp_max']:>12.2f} {data['unit']}")
    
    print(f"\n  Improvement vs Fixed-Time:")
    if data['dqn_improvement'] > 0:
        symbol = '↓' if data['lower_is_better'] else '↑'
        print(f"    DQN:              {symbol} {data['dqn_improvement']:>8.2f}% (better)")
    else:
        symbol = '↑' if data['lower_is_better'] else '↓'
        print(f"    DQN:              {symbol} {abs(data['dqn_improvement']):>8.2f}% (worse)")
    
    if data['mp_improvement'] > 0:
        symbol = '↓' if data['lower_is_better'] else '↑'
        print(f"    PE-DQN:  {symbol} {data['mp_improvement']:>8.2f}% (better)")
    else:
        symbol = '↑' if data['lower_is_better'] else '↓'
        print(f"    PE-DQN:  {symbol} {abs(data['mp_improvement']):>8.2f}% (worse)")

print("\n" + "="*80)

# Determine best performer for each metric
print("\n" + "="*80)
print("BEST PERFORMERS")
print("="*80)

for metric_name, data in metrics.items():
    if metric_name == 'Cumulative Reward':
        values = {'DQN': data['dqn_total'], 'Fixed-Time': data['fixed_total'], 'PE-DQN': data['mp_total']}
        best = max(values, key=values.get)
    else:
        values = {'DQN': data['dqn_avg'], 'Fixed-Time': data['fixed_avg'], 'PE-DQN': data['mp_avg']}
        best = min(values, key=values.get) if data['lower_is_better'] else max(values, key=values.get)
    
    print(f"\n{metric_name}: {best} (Value: {values[best]:.2f})")

print("\n" + "="*80)

# Create comprehensive visualization
fig = plt.figure(figsize=(20, 12))
gs = fig.add_gridspec(3, 2, hspace=0.3, wspace=0.3)

metric_list = ['Queue Length', 'Avg Waiting Time', 'Cumulative Reward']
colors = {'dqn': '#3498db', 'fixed': '#e74c3c', 'mp': '#2ecc71'}

for idx, metric_name in enumerate(metric_list):
    data = metrics[metric_name]
    
    # Left column: Time series plots
    ax1 = fig.add_subplot(gs[idx, 0])
    ax1.plot(data['dqn_data'], label='DQN', linewidth=1.5, alpha=0.8, color=colors['dqn'])
    ax1.plot(data['fixed_data'], label='Fixed-Time', linewidth=1.5, alpha=0.7, color=colors['fixed'])
    ax1.plot(data['mp_data'], label='PE-DQN', linewidth=1.5, alpha=0.8, color=colors['mp'])
    ax1.set_xlabel('Simulation Step', fontsize=10)
    
    if metric_name == 'Cumulative Reward':
        ax1.set_ylabel(f'{metric_name}', fontsize=10)
        ax1.set_title(f'{metric_name} Over Time', fontsize=11, fontweight='bold')
    else:
        ax1.set_ylabel(f'{metric_name} ({data["unit"]})', fontsize=10)
        ax1.set_title(f'{metric_name} Over Time', fontsize=11, fontweight='bold')
    
    ax1.legend(fontsize=9, loc='best')
    ax1.grid(True, alpha=0.3)
    
    # Right column: Bar comparisons
    ax2 = fig.add_subplot(gs[idx, 1])
    
    if metric_name == 'Cumulative Reward':
        values = [data['dqn_total'], data['fixed_total'], data['mp_total']]
        ylabel = f'Total {metric_name}'
    else:
        values = [data['dqn_avg'], data['fixed_avg'], data['mp_avg']]
        ylabel = f'Average {metric_name} ({data["unit"]})'
    
    bars = ax2.bar(['DQN', 'Fixed-Time', 'PE-DQN'], values,
                   color=[colors['dqn'], colors['fixed'], colors['mp']], 
                   alpha=0.7, edgecolor='black', linewidth=1.5)
    
    ax2.set_ylabel(ylabel, fontsize=10)
    ax2.set_title(f'{metric_name} Comparison', fontsize=11, fontweight='bold')
    ax2.grid(True, alpha=0.3, axis='y')
    
    # Add value labels on bars
    for bar in bars:
        height = bar.get_height()
        if metric_name == 'Cumulative Reward':
            ax2.text(bar.get_x() + bar.get_width()/2., height,
                    f'{height:,.0f}',
                    ha='center', va='bottom', fontsize=9, fontweight='bold')
        else:
            ax2.text(bar.get_x() + bar.get_width()/2., height,
                    f'{height:.2f}',
                    ha='center', va='bottom', fontsize=9, fontweight='bold')
    
    # Highlight the best performer
    if metric_name == 'Cumulative Reward':
        best_idx = values.index(max(values))
    else:
        best_idx = values.index(min(values)) if data['lower_is_better'] else values.index(max(values))
    
    bars[best_idx].set_edgecolor('gold')
    bars[best_idx].set_linewidth(3)
    
    # Add improvement percentages as text
    y_pos = max(values) * 0.15
    improvements = [data['dqn_improvement'], 0, data['mp_improvement']]
    
    for i, (bar, improvement) in enumerate(zip(bars, improvements)):
        if i != 1:  # Skip fixed-time (baseline)
            if improvement > 0:
                text = f'+{improvement:.1f}%'
                color = 'green'
            else:
                text = f'{improvement:.1f}%'
                color = 'red'
            
            ax2.text(bar.get_x() + bar.get_width()/2., y_pos,
                    text, ha='center', fontsize=9, fontweight='bold', color=color)

# Add overall title
fig.suptitle('Comprehensive Performance Comparison: DQN vs Fixed-Time vs PE-DQN', 
             fontsize=14, fontweight='bold', y=0.995)

# Save figure
os.makedirs('comparison', exist_ok=True)
output_path = 'comparison/three_way_comparison_all_methods_finalless.png'
plt.savefig(output_path, dpi=300, bbox_inches='tight')
print(f"\nVisualization saved: {output_path}")
plt.close()

print("\nComparison complete!")