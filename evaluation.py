import numpy as np
import os

def calculate_average_queue(file_path):
    """
    Calculate average queue length from a text file.
    Each line should contain a single numeric value.
    """
    try:
        with open(file_path, 'r') as f:
            data = [float(line.strip()) for line in f if line.strip()]
        
        if not data:
            print(f"No data found in {file_path}")
            return None
        
        queue_array = np.array(data)
        
        # Calculate statistics
        avg = np.mean(queue_array)
        std = np.std(queue_array)
        minimum = np.min(queue_array)
        maximum = np.max(queue_array)
        median = np.median(queue_array)
        
        # Print results
        print(f"\n{'='*50}")
        print(f"File: {os.path.basename(file_path)}")
        print(f"{'='*50}")
        print(f"Total Episodes:    {len(queue_array)}")
        print(f"Average Queue:     {avg:.4f}")
        print(f"Standard Dev:      {std:.4f}")
        print(f"Median Queue:      {median:.4f}")
        print(f"Min Queue:         {minimum:.4f}")
        print(f"Max Queue:         {maximum:.4f}")
        print(f"{'='*50}\n")
        
        return {
            'average': avg,
            'std': std,
            'min': minimum,
            'max': maximum,
            'median': median,
            'count': len(queue_array)
        }
    
    except FileNotFoundError:
        print(f"Error: File '{file_path}' not found!")
        return None
    except ValueError as e:
        print(f"Error reading file: {e}")
        return None

# Main execution
if __name__ == "__main__":
    base_path = r"C:\Users\Asus\OneDrive\Desktop\comparison_graph"
    
    print("="*60)
    print("QUEUE LENGTH STATISTICS COMPARISON")
    print("="*60)
    
    # Define all files to analyze
    files = {
        "DQN Training": os.path.join(base_path, "models_dqn", "model_14", "plot_queue_data.txt"),
        "DQN Testing": os.path.join(base_path, "models_dqn", "model_14", "test", "plot_queue_data.txt"),
        "DQN+MP Training": os.path.join(base_path, "models_dqnmp", "model_16", "plot_queue_data.txt"),
        "DQN+MP Testing": os.path.join(base_path, "models_dqnmp", "model_16", "test", "plot_queue_data.txt"),
    }
    
    results = {}
    
    # Calculate statistics for each file
    for name, file_path in files.items():
        print(f"\n{'='*60}")
        print(f"Analyzing: {name}")
        print(f"{'='*60}")
        if os.path.exists(file_path):
            results[name] = calculate_average_queue(file_path)
        else:
            print(f"✗ File not found: {file_path}\n")
    
    # Summary comparison
    if len(results) >= 2:
        print("\n" + "="*60)
        print("SUMMARY COMPARISON")
        print("="*60)
        
        # Compare Training
        if "DQN Training" in results and "DQN+MP Training" in results:
            dqn_train = results["DQN Training"]['average']
            dqnmp_train = results["DQN+MP Training"]['average']
            difference = dqnmp_train - dqn_train
            percent_diff = (difference / dqn_train) * 100
            
            print(f"\n📊 TRAINING Comparison:")
            print(f"   DQN Average:       {dqn_train:.2f} vehicles")
            print(f"   DQN+MP Average:    {dqnmp_train:.2f} vehicles")
            print(f"   Difference:        {difference:+.2f} vehicles ({percent_diff:+.2f}%)")
            if dqn_train < dqnmp_train:
                print(f"   Winner: DQN (lower queue by {abs(difference):.2f} vehicles) ✓")
            else:
                print(f"   Winner: DQN+MP (lower queue by {abs(difference):.2f} vehicles) ✓")
        
        # Compare Testing
        if "DQN Testing" in results and "DQN+MP Testing" in results:
            dqn_test = results["DQN Testing"]['average']
            dqnmp_test = results["DQN+MP Testing"]['average']
            difference = dqnmp_test - dqn_test
            percent_diff = (difference / dqn_test) * 100
            
            print(f"\n📊 TESTING Comparison:")
            print(f"   DQN Average:       {dqn_test:.2f} vehicles")
            print(f"   DQN+MP Average:    {dqnmp_test:.2f} vehicles")
            print(f"   Difference:        {difference:+.2f} vehicles ({percent_diff:+.2f}%)")
            if dqn_test < dqnmp_test:
                print(f"   Winner: DQN (lower queue by {abs(difference):.2f} vehicles) ✓")
            else:
                print(f"   Winner: DQN+MP (lower queue by {abs(difference):.2f} vehicles) ✓")
        
        print("\n" + "="*60)