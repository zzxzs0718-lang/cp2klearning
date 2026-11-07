# -*- coding:utf-8 -*-
"""
@author: Jin-Cheng Liu
@file: gaussian
@time: 2017/11/13 14:42
this is a script to sum the gaussian hill of MTD simulations.
It can read VASP results with 1D and 2D colvar, and CP2K results with 1D colvar.
usage: for 1D surface : python gaussian.py 1 x1 x2 
	   for 2D surface : python gaussian.py 2 x1 x2 y1 y2
"""

from matplotlib import pyplot as plt
import numpy as np
import sys


hillType = "CP2K"  # VASP or CP2K or CP2k-7
fileName = "cp2k-HILLS.metadynLog"
dimension = sys.argv[1]     # one or two
grid = 200            # decide the how fine of the curve or plot, 5000 is enough

if dimension == '1':
	scope1 = [float(sys.argv[2]), float(sys.argv[3])]
if dimension == '2':
	scope1 = [float(sys.argv[2]), float(sys.argv[3])]
	scope2 = [float(sys.argv[4]), float(sys.argv[5])]

# get all points on gaussian functions.
def gaussian(a, x, mu, sig):
    return a*np.exp(-np.power(x - mu, 2.) / (2 * np.power(sig, 2.)))


def gaussian_2(a, x, y, mu1, mu2, sig):
    return a*np.exp(-np.power(x - mu1, 2.) / (2 * np.power(sig, 2.)))\
            *np.exp(-np.power(y - mu2, 2.) / (2 * np.power(sig, 2.)))


# read input HILLSPOT files
def readlines(fileName):
    with open(fileName, 'r') as f:
        lines = f.readlines()
        print('total lines:', len(lines))
        lines = list(map(lambda x: x.strip(), lines))
    for j in range(len(lines)):
        lines[j] = list(map(lambda x: float(x), lines[j].split()))
    return lines

if dimension == '1':
    # scope1 = [-5., 10.]
    sumList = []
    xCoord = np.linspace(scope[0], scope[1], grid)
    count = 0
    if hillType == "VASP":
        for mu, a, sig in readlines(fileName):
            sumList.append(gaussian(a, np.linspace(scope[0], scope[1], grid), mu, sig))
            count += 1
            if count % 100 == 0:
                plt.plot(xCoord, np.array([sum(x) for x in zip(*sumList)]))
        #    print(gaussian(a, np.linspace(0, 1, 200), mu, sig))           # debug
        #    plt.plot(gaussian(a, np.linspace(0, 1, 1000), mu, sig))       # for show all the gaussian function separately.
    elif hillType == "CP2K":
        for time, mu, sig, a in readlines(fileName):
            sumList.append(gaussian_2(a*27.211, np.linspace(scope[0], scope[1], grid), mu*0.5291772, sig*0.5291772))
    else:
        raise ValueError("Error: only support format of VASP or CP2K")
    plt.plot(xCoord, np.array([sum(x) for x in zip(*sumList)]))
    plt.savefig("meta.png")

elif dimension == '2':
    if hillType == "VASP":
        # scope1 = [0, 3.]
        # scope2 = [0, 3.]
        sumList = []
        # generate mesh
        x = np.linspace(scope1[0], scope1[1], grid)
        y = np.linspace(scope2[0], scope2[1], grid)
        X, Y = np.meshgrid(x, y)
        for mu1, mu2, a, sig in readlines(fileName):
            sumList.append(gaussian_2(a, X, Y, mu1, mu2, sig))
            # print(np.array([sum(x) for x in zip(*sumList)]))  # debug
    elif hillType == "CP2K":
        scope1 = [scope1[0], scope1[1]]
        scope2 = [scope2[0], scope2[1]]
        sumList = []
        # generate mesh
        x = np.linspace(scope1[0], scope1[1], grid)
        y = np.linspace(scope2[0], scope2[1], grid)
        X, Y = np.meshgrid(x, y)
        for time, mu1, mu2, sig1, sig2, a in readlines(fileName):
            sumList.append(gaussian_2(a*27.211, X, Y, mu1*0.529177249, mu2*0.529177249, sig1*0.529177249))  # bugs here, need to separate sig1/2
            # print(np.array([sum(x) for x in zip(*sumList)]))  # debug
    elif hillType == "CP2K-7":
        scope1 = [scope1[0], scope1[1]]
        scope2 = [scope2[0], scope2[1]]
        sumList = []
        # generate mesh
        x = np.linspace(scope1[0], scope1[1], grid)
        y = np.linspace(scope2[0], scope2[1], grid)
        X, Y = np.meshgrid(x, y)
        for time, mu1, mu2, mu3, mu4, mu5, mu6, mu7, mu8, mu9, sig1, sig2, sig3, sig4, sig5, sig6, sig7, sig8, sig9, a in readlines(fileName):
            sumList.append(gaussian_2(a*27.211, X, Y, mu1*0.529177249, mu2*0.529177249, sig1*0.529177249))  # bugs here, need to separate sig1/2
            # print(np.array([sum(x) for x in zip(*sumList)]))  # debug
    else:
        raise ValueError("Error: only support format of VASP or CP2K")
    # use plt.contourf to filling contours
    # X, Y and value for (X,Y) point
    # 位置参数分别为：X, Y, f(X,Y)。透明度0.75，并将 f(X,Y) 的值对应到color map的暖色组中寻找对应颜色。
    outFile = "./graph.txt"
    outFileWrite = open(outFile, 'w')
    line = []
    for i in np.array([sum(x) for x in zip(*sumList)]):
        i = ['{:.9f}'.format(j) for j in i.tolist()]
        line.append(' '.join(i))
    outFileWrite.write('\n'.join(line)) 
    # 填充颜色
    plt.contourf(X, Y, np.array([sum(x) for x in zip(*sumList)]), 8, alpha=.75, cmap=plt.cm.hot)
    # use plt.contour to add contour lines
    # 8代表等高线的密集程度，这里被分为10个部分
    C = plt.contour(X, Y, np.array([sum(x) for x in zip(*sumList)]), 8, colors='black', linewidths=.5)

    # 最后加入Label，inline控制是否将Label画在线里面，字体大小为10。并将坐标轴隐藏：
    plt.clabel(C, inline=True, fontsize=10)
    print("show")
    plt.show()
